-- Run this in Supabase SQL Editor after applying the admin seed.
-- It verifies that admin@gmail.com exists in Auth and has the public admin role.
SELECT
  u.id,
  u.email,
  u.email_confirmed_at IS NOT NULL AS email_confirmed,
  u.encrypted_password IS NOT NULL AS has_password,
  COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE lower(u.email) = lower('admin@gmail.com')
GROUP BY u.id, u.email, u.email_confirmed_at, u.encrypted_password;
