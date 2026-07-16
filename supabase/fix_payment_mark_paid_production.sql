-- Fix payment "mark paid" failures in production.
--
-- Symptom:
--   The app opens a receipt tab that says:
--   "Payment was not marked paid. Please close this tab and try again."
--
-- Cause:
--   The payments table is protected by RLS. Only users with a row in
--   public.user_roles(role = 'admin') can update payments to paid.
--
-- Run this in Supabase SQL Editor.

-- 1) Recreate the admin payment policy.
DROP POLICY IF EXISTS "Admins manage payments" ON public.payments;

CREATE POLICY "Admins manage payments"
  ON public.payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Make sure the default admin account has the real DB admin role.
-- Change this email if your cashier/admin login uses another address.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE lower(email) = lower('admin@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- 3) Verify the admin role exists.
SELECT
  u.id,
  u.email,
  COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles,
  public.has_role(u.id, 'admin') AS can_mark_payments_paid
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE lower(u.email) = lower('admin@gmail.com')
GROUP BY u.id, u.email;

NOTIFY pgrst, 'reload schema';
