-- Production student avatar upload fix.
-- Run this by itself in the hosted Supabase SQL Editor when image upload says:
-- "new row violates row-level security policy".

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-avatars',
  'student-avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Student avatars read" ON storage.objects;
DROP POLICY IF EXISTS "Student avatars insert" ON storage.objects;
DROP POLICY IF EXISTS "Student avatars update" ON storage.objects;
DROP POLICY IF EXISTS "Student avatars delete" ON storage.objects;

CREATE POLICY "Student avatars read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'student-avatars');

CREATE POLICY "Student avatars insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'student-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Student avatars update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'student-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'student-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Student avatars delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'student-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

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
  EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'student-avatars'
      AND public = true
  ) AS student_avatars_bucket_ready,
  count(*) FILTER (
    WHERE policyname IN (
      'Student avatars read',
      'Student avatars insert',
      'Student avatars update',
      'Student avatars delete'
    )
  ) AS student_avatar_policy_count
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects';
