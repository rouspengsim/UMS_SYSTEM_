-- Run this in Supabase SQL Editor after the base tables exist.
-- It repairs the admin login, installs the student/teacher account helpers,
-- hardens signup roles, reloads PostgREST schema, and returns verification rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DROP FUNCTION IF EXISTS public.admin_create_school_auth_account(
  public.app_role,
  TEXT,
  TEXT,
  TEXT,
  TEXT
);

DROP FUNCTION IF EXISTS public.generate_school_login_code(public.app_role);

DO $$
DECLARE
  admin_email CONSTANT TEXT := 'admin@gmail.com';
  admin_password CONSTANT TEXT := 'Admin@123';
  admin_name CONSTANT TEXT := 'Admin';
  admin_user_id UUID;
BEGIN
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE lower(email) = lower(admin_email)
  ORDER BY created_at
  LIMIT 1;

  IF admin_user_id IS NULL THEN
    admin_user_id := gen_random_uuid();

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
      admin_user_id,
      'authenticated',
      'authenticated',
      admin_email,
      extensions.crypt(admin_password, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('full_name', admin_name, 'role', 'admin'),
      now(),
      now()
    );
  ELSE
    UPDATE auth.users
    SET
      aud = 'authenticated',
      role = 'authenticated',
      email = admin_email,
      encrypted_password = extensions.crypt(admin_password, extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) ||
        jsonb_build_object('full_name', admin_name, 'role', 'admin'),
      updated_at = now()
    WHERE id = admin_user_id;
  END IF;

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
    admin_user_id,
    admin_user_id,
    admin_user_id::text,
    jsonb_build_object(
      'sub', admin_user_id::text,
      'email', admin_email,
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
  VALUES (admin_user_id, admin_name, admin_email, NULL)
  ON CONFLICT ON CONSTRAINT profiles_user_id_key DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT ON CONSTRAINT user_roles_user_id_role_key DO NOTHING;

  DELETE FROM public.user_roles
  WHERE user_id = admin_user_id
    AND role <> 'admin';
END;
$$;

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
    new_user_id,
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role TEXT;
  assigned_role public.app_role;
BEGIN
  requested_role := NEW.raw_user_meta_data->>'role';
  assigned_role := CASE
    WHEN requested_role = 'teacher' THEN 'teacher'::public.app_role
    ELSE 'student'::public.app_role
  END;

  INSERT INTO public.profiles (user_id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT ON CONSTRAINT profiles_user_id_key DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT ON CONSTRAINT user_roles_user_id_role_key DO NOTHING;

  DELETE FROM public.user_roles
  WHERE user_id = NEW.id
    AND role = 'admin';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.prevent_client_admin_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
    AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  THEN
    IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.role = 'admin' THEN
      RAISE EXCEPTION 'Admin roles can only be managed from trusted database operations.';
    END IF;

    IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.role = 'admin' THEN
      RAISE EXCEPTION 'Admin roles can only be managed from trusted database operations.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_client_admin_role_changes ON public.user_roles;
CREATE TRIGGER trg_prevent_client_admin_role_changes
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_client_admin_role_changes();

NOTIFY pgrst, 'reload schema';

SELECT
  u.email,
  crypt('Admin@123', u.encrypted_password) = u.encrypted_password AS password_matches,
  u.email_confirmed_at IS NOT NULL AS confirmed,
  u.encrypted_password IS NOT NULL AS has_password,
  COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE lower(u.email) = 'admin@gmail.com'
GROUP BY u.id, u.email, u.email_confirmed_at, u.encrypted_password;

SELECT
  provider,
  provider_id,
  user_id,
  identity_data->>'email' AS email
FROM auth.identities
WHERE user_id = (
  SELECT id FROM auth.users WHERE lower(email) = 'admin@gmail.com' LIMIT 1
);
