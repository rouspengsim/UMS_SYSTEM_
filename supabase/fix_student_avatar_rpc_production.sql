-- Production student avatar RPC fix.
-- Run this by itself in the hosted Supabase SQL Editor if upload says:
-- "Could not find the function public.set_student_avatar(...) in the schema cache".

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE OR REPLACE FUNCTION public.set_student_avatar(
  p_student_id uuid,
  p_avatar_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  SELECT user_id
  INTO target_user_id
  FROM public.students
  WHERE id = p_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR target_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You cannot update this student profile image';
  END IF;

  UPDATE public.students
  SET avatar_url = NULLIF(trim(p_avatar_url), '')
  WHERE id = p_student_id;

  IF target_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET avatar_url = NULLIF(trim(p_avatar_url), '')
    WHERE user_id = target_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_student_avatar(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'set_student_avatar';
