CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DROP FUNCTION IF EXISTS public.admin_create_school_auth_account(
  public.app_role,
  TEXT,
  TEXT,
  TEXT,
  TEXT
);

DROP FUNCTION IF EXISTS public.generate_school_login_code(public.app_role);

CREATE OR REPLACE FUNCTION public.school_account_login_email(
  p_role public.app_role,
  p_login_code TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(
    p_role::text || '.' ||
    regexp_replace(trim(p_login_code), '[^a-zA-Z0-9]+', '.', 'g') ||
    '@studentsphere.local'
  );
$$;

CREATE OR REPLACE FUNCTION public.generate_school_login_code(
  p_role public.app_role,
  p_enrollment_year INT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_prefix TEXT;
  generated_code TEXT;
  attempts INT := 0;
BEGIN
  IF p_role = 'student' THEN
    code_prefix := 'RULE' || right(coalesce(p_enrollment_year, EXTRACT(YEAR FROM now())::INT)::TEXT, 2) || '-';
  ELSIF p_role = 'teacher' THEN
    code_prefix := 'TCH' || to_char(now(), 'YY') || '-';
  ELSE
    RAISE EXCEPTION 'Only student and teacher accounts use generated login IDs.';
  END IF;

  LOOP
    attempts := attempts + 1;
    generated_code := code_prefix || floor(1000 + random() * 9000)::INT::TEXT;

    IF p_role = 'student' AND NOT EXISTS (
      SELECT 1 FROM public.students WHERE student_code = generated_code
    ) THEN
      RETURN generated_code;
    END IF;

    IF p_role = 'teacher' AND NOT EXISTS (
      SELECT 1 FROM public.teachers WHERE staff_code = generated_code
    ) THEN
      RETURN generated_code;
    END IF;

    IF attempts >= 50 THEN
      RAISE EXCEPTION 'Could not generate a unique login ID. Try again.';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_school_auth_account(
  p_role public.app_role,
  p_password TEXT,
  p_full_name TEXT,
  p_login_code TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_enrollment_year INT DEFAULT NULL
)
RETURNS TABLE(user_id UUID, login_code TEXT, login_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  new_user_id UUID;
  normalized_code TEXT;
  auth_email TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can create school login accounts.';
  END IF;

  IF p_role NOT IN ('student', 'teacher') THEN
    RAISE EXCEPTION 'Only student and teacher accounts can be created here.';
  END IF;

  IF length(coalesce(p_password, '')) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters.';
  END IF;

  normalized_code := upper(nullif(trim(coalesce(p_login_code, '')), ''));
  IF normalized_code IS NULL THEN
    normalized_code := public.generate_school_login_code(p_role, p_enrollment_year);
  END IF;

  IF p_role = 'student' AND EXISTS (
    SELECT 1 FROM public.students WHERE student_code = normalized_code
  ) THEN
    RAISE EXCEPTION 'Student ID % already exists.', normalized_code;
  END IF;

  IF p_role = 'teacher' AND EXISTS (
    SELECT 1 FROM public.teachers WHERE staff_code = normalized_code
  ) THEN
    RAISE EXCEPTION 'Teacher ID % already exists.', normalized_code;
  END IF;

  auth_email := public.school_account_login_email(p_role, normalized_code);

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = auth_email) THEN
    RAISE EXCEPTION 'Login account % already exists.', normalized_code;
  END IF;

  new_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    auth_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object(
      'full_name', coalesce(nullif(trim(p_full_name), ''), normalized_code),
      'role', p_role::text,
      'login_code', normalized_code,
      'contact_email', nullif(trim(coalesce(p_contact_email, '')), '')
    ),
    now(),
    now()
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    new_user_id,
    new_user_id::text,
    jsonb_build_object(
      'sub', new_user_id::text,
      'email', auth_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider_id, provider) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    identity_data = EXCLUDED.identity_data,
    updated_at = now();

  INSERT INTO public.profiles (user_id, full_name, email, avatar_url)
  VALUES (
    new_user_id,
    coalesce(nullif(trim(p_full_name), ''), normalized_code),
    nullif(trim(coalesce(p_contact_email, '')), ''),
    NULL
  )
  ON CONFLICT ON CONSTRAINT profiles_user_id_key DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, p_role)
  ON CONFLICT ON CONSTRAINT user_roles_user_id_role_key DO NOTHING;

  user_id := new_user_id;
  login_code := normalized_code;
  login_email := auth_email;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_school_auth_account(
  public.app_role,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  INT
) TO authenticated;
