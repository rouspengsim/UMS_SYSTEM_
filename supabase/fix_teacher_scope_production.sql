-- Production teacher-role visibility fix.
-- Run this in the hosted Supabase SQL Editor if teacher accounts work locally
-- but do not see classes, schedules, attendance, or exam options after Vercel deploy.

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS full_name_km text,
  ADD COLUMN IF NOT EXISTS full_name_en text,
  ADD COLUMN IF NOT EXISTS faculty text;

ALTER TABLE public.timetable_slots
  ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS teacher_name text,
  ADD COLUMN IF NOT EXISTS teacher_phone text,
  ADD COLUMN IF NOT EXISTS subject_code text,
  ADD COLUMN IF NOT EXISTS subject_name text,
  ADD COLUMN IF NOT EXISTS schedule_title text,
  ADD COLUMN IF NOT EXISTS academic_year text,
  ADD COLUMN IF NOT EXISTS issue_date date,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS left_office text,
  ADD COLUMN IF NOT EXISTS center_signature text,
  ADD COLUMN IF NOT EXISTS right_signature text;

CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON public.timetable_slots(teacher_id);
CREATE INDEX IF NOT EXISTS idx_timetable_class_day_time
  ON public.timetable_slots(class_id, day, start_time, end_time);

CREATE OR REPLACE FUNCTION public.current_teacher_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id
  FROM public.teachers t
  WHERE t.user_id = auth.uid()
    OR (
      t.email IS NOT NULL
      AND lower(t.email) = lower(coalesce(auth.jwt()->>'email', ''))
    )
    OR (
      t.staff_code IS NOT NULL
      AND upper(t.staff_code) = upper(coalesce(auth.jwt()->'user_metadata'->>'login_code', ''))
    )
    OR (
      t.staff_code IS NOT NULL
      AND lower(coalesce(auth.jwt()->>'email', '')) LIKE
        lower(
          'teacher.' ||
          regexp_replace(trim(t.staff_code), '[^a-zA-Z0-9]+', '.', 'g') ||
          '@%'
        )
    )
  ORDER BY
    CASE WHEN t.user_id = auth.uid() THEN 0 ELSE 1 END,
    t.created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.timetable_slot_matches_teacher(
  p_room text,
  p_teacher_id uuid,
  p_teacher_name text,
  p_current_teacher_id uuid,
  p_current_teacher_full_name text,
  p_current_teacher_full_name_en text,
  p_current_teacher_full_name_km text,
  p_current_teacher_staff_code text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  encoded_prefix constant text := '__STUDENTSPHERE_TIMETABLE_CELL__:';
BEGIN
  IF p_teacher_id = p_current_teacher_id THEN
    RETURN true;
  END IF;

  IF p_teacher_name IS NOT NULL AND lower(trim(p_teacher_name)) IN (
    lower(trim(coalesce(p_current_teacher_full_name, ''))),
    lower(trim(coalesce(p_current_teacher_full_name_en, ''))),
    lower(trim(coalesce(p_current_teacher_full_name_km, ''))),
    lower(trim(coalesce(p_current_teacher_staff_code, '')))
  ) THEN
    RETURN true;
  END IF;

  IF p_room IS NULL OR left(ltrim(p_room), length(encoded_prefix)) <> encoded_prefix THEN
    RETURN false;
  END IF;

  BEGIN
    payload := substring(ltrim(p_room) from length(encoded_prefix) + 1)::jsonb;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  RETURN
    payload->>'teacherId' = p_current_teacher_id::text
    OR lower(trim(coalesce(payload->>'teacher', ''))) IN (
      lower(trim(coalesce(p_current_teacher_full_name, ''))),
      lower(trim(coalesce(p_current_teacher_full_name_en, ''))),
      lower(trim(coalesce(p_current_teacher_full_name_km, ''))),
      lower(trim(coalesce(p_current_teacher_staff_code, '')))
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_read_class(
  p_class_id uuid,
  p_class_name text,
  p_class_teacher_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH current_teacher AS (
    SELECT t.*
    FROM public.teachers t
    WHERE t.id = public.current_teacher_id()
  )
  SELECT EXISTS (
    SELECT 1
    FROM current_teacher t
    WHERE p_class_teacher_id = t.id
      OR EXISTS (
        SELECT 1
        FROM public.timetable_slots ts
        WHERE ts.class_id = p_class_id
          AND public.timetable_slot_matches_teacher(
            ts.room,
            ts.teacher_id,
            ts.teacher_name,
            t.id,
            t.full_name,
            t.full_name_en,
            t.full_name_km,
            t.staff_code
          )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_teacher_classes()
RETURNS TABLE(
  id uuid,
  name text,
  subject_code text,
  room text,
  capacity integer,
  semester text,
  teacher_id uuid,
  teacher_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.name,
    c.subject_code,
    c.room,
    c.capacity,
    c.semester,
    coalesce(c.teacher_id, current_teacher.id) AS teacher_id,
    coalesce(assigned_teacher.full_name, current_teacher.full_name) AS teacher_name
  FROM public.classes c
  CROSS JOIN (
    SELECT t.*
    FROM public.teachers t
    WHERE t.id = public.current_teacher_id()
  ) current_teacher
  LEFT JOIN public.teachers assigned_teacher ON assigned_teacher.id = c.teacher_id
  WHERE c.teacher_id = current_teacher.id
    OR EXISTS (
      SELECT 1
      FROM public.timetable_slots ts
      WHERE ts.class_id = c.id
        AND public.timetable_slot_matches_teacher(
          ts.room,
          ts.teacher_id,
          ts.teacher_name,
          current_teacher.id,
          current_teacher.full_name,
          current_teacher.full_name_en,
          current_teacher.full_name_km,
          current_teacher.staff_code
        )
    )
  ORDER BY c.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.teacher_scope_diagnostics()
RETURNS TABLE(
  auth_user_id uuid,
  auth_email text,
  auth_login_code text,
  matched_teacher_id uuid,
  matched_staff_code text,
  matched_teacher_name text,
  assigned_class_count bigint,
  total_class_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() AS auth_user_id,
    auth.jwt()->>'email' AS auth_email,
    auth.jwt()->'user_metadata'->>'login_code' AS auth_login_code,
    t.id AS matched_teacher_id,
    t.staff_code AS matched_staff_code,
    t.full_name AS matched_teacher_name,
    count(c.id) FILTER (WHERE public.teacher_can_read_class(c.id, c.name, c.teacher_id)) AS assigned_class_count,
    (SELECT count(*) FROM public.classes) AS total_class_count
  FROM (SELECT public.current_teacher_id() AS id) current_teacher
  LEFT JOIN public.teachers t ON t.id = current_teacher.id
  LEFT JOIN public.classes c ON true
  GROUP BY t.id, t.staff_code, t.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.current_teacher_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.timetable_slot_matches_teacher(text, uuid, text, uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_read_class(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_teacher_classes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_scope_diagnostics() TO authenticated;

UPDATE public.teachers t
SET user_id = auth_users.id
FROM auth.users auth_users
WHERE t.user_id IS NULL
  AND t.staff_code IS NOT NULL
  AND lower(auth_users.email) LIKE
    lower(
      'teacher.' ||
      regexp_replace(trim(t.staff_code), '[^a-zA-Z0-9]+', '.', 'g') ||
      '@%'
    );

UPDATE public.classes c
SET teacher_id = assigned.teacher_id
FROM (
  SELECT DISTINCT ON (ts.class_id)
    ts.class_id,
    ts.teacher_id
  FROM public.timetable_slots ts
  WHERE ts.teacher_id IS NOT NULL
  ORDER BY ts.class_id, ts.created_at DESC
) assigned
WHERE c.teacher_id IS NULL
  AND c.id = assigned.class_id;

UPDATE public.classes c
SET teacher_id = matched.teacher_id
FROM (
  SELECT DISTINCT ON (ts.class_id)
    ts.class_id,
    t.id AS teacher_id
  FROM public.timetable_slots ts
  JOIN public.teachers t
    ON public.timetable_slot_matches_teacher(
      ts.room,
      ts.teacher_id,
      ts.teacher_name,
      t.id,
      t.full_name,
      t.full_name_en,
      t.full_name_km,
      t.staff_code
    )
  ORDER BY ts.class_id, ts.created_at DESC
) matched
WHERE c.teacher_id IS NULL
  AND c.id = matched.class_id;

DROP POLICY IF EXISTS "Authenticated read classes" ON public.classes;
DROP POLICY IF EXISTS "Role scoped read classes" ON public.classes;

CREATE POLICY "Role scoped read classes"
  ON public.classes
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'teacher')
      AND public.teacher_can_read_class(classes.id, classes.name, classes.teacher_id)
    )
    OR (
      public.has_role(auth.uid(), 'student')
      AND EXISTS (
        SELECT 1
        FROM public.students s
        WHERE s.user_id = auth.uid()
          AND s.class_name = classes.name
      )
    )
  );

DROP POLICY IF EXISTS "Read timetable" ON public.timetable_slots;
DROP POLICY IF EXISTS "Admins manage timetable" ON public.timetable_slots;
DROP POLICY IF EXISTS "Admins insert timetable" ON public.timetable_slots;
DROP POLICY IF EXISTS "Admins update timetable" ON public.timetable_slots;
DROP POLICY IF EXISTS "Admins delete timetable" ON public.timetable_slots;
DROP POLICY IF EXISTS "Authenticated manage timetable" ON public.timetable_slots;
DROP POLICY IF EXISTS "Teachers manage timetable" ON public.timetable_slots;
DROP POLICY IF EXISTS "Students manage timetable" ON public.timetable_slots;

CREATE POLICY "Read timetable"
  ON public.timetable_slots
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins insert timetable"
  ON public.timetable_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update timetable"
  ON public.timetable_slots
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete timetable"
  ON public.timetable_slots
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Student profile image upload fix for hosted deployments.
-- Repairs the public storage bucket, storage RLS policies, and avatar update RPC.
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
