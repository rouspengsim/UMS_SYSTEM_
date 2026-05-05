
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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
    gen_random_uuid(),
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
  ON CONFLICT (user_id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.user_roles
  WHERE user_id = admin_user_id
    AND role <> 'admin';
END;
$$;
