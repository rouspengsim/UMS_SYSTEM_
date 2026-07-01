-- Safer hosted-Supabase admin repair.
--
-- Why this exists:
-- Directly inserting rows into auth.users/auth.identities can break on hosted
-- Supabase when the internal Auth schema/version differs. If app login returns
-- "Database error querying schema", use Supabase Dashboard to create the Auth
-- user, then use this file to attach the public app profile and admin role.
--
-- Step 1: run ONLY this cleanup block first.
DELETE FROM auth.identities
WHERE user_id IN (
  SELECT id FROM auth.users WHERE lower(email) = 'admin@gmail.com'
);

DELETE FROM public.user_roles
WHERE user_id IN (
  SELECT id FROM auth.users WHERE lower(email) = 'admin@gmail.com'
);

DELETE FROM public.profiles
WHERE user_id IN (
  SELECT id FROM auth.users WHERE lower(email) = 'admin@gmail.com'
);

DELETE FROM auth.users
WHERE lower(email) = 'admin@gmail.com';

NOTIFY pgrst, 'reload schema';

-- Step 2: go to Supabase Dashboard > Authentication > Users > Add user.
-- Email: admin@gmail.com
-- Password: Admin@123
-- Auto Confirm Email: enabled
--
-- Step 3: after Dashboard creates the user, run this attach block.
INSERT INTO public.profiles (user_id, full_name, email, avatar_url)
SELECT id, 'Admin', email, NULL
FROM auth.users
WHERE lower(email) = 'admin@gmail.com'
ON CONFLICT (user_id) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  updated_at = now();

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE lower(email) = 'admin@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles
WHERE user_id IN (
  SELECT id FROM auth.users WHERE lower(email) = 'admin@gmail.com'
)
AND role <> 'admin';

NOTIFY pgrst, 'reload schema';

-- Step 4: verify.
SELECT
  u.email,
  u.email_confirmed_at IS NOT NULL AS confirmed,
  u.encrypted_password IS NOT NULL AS has_password,
  COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE lower(u.email) = 'admin@gmail.com'
GROUP BY u.id, u.email, u.email_confirmed_at, u.encrypted_password;
