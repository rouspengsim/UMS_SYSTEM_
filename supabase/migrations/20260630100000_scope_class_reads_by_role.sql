ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS full_name_km text,
  ADD COLUMN IF NOT EXISTS full_name_en text,
  ADD COLUMN IF NOT EXISTS faculty text;

ALTER TABLE public.timetable_slots
  ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS teacher_name text,
  ADD COLUMN IF NOT EXISTS teacher_phone text,
  ADD COLUMN IF NOT EXISTS subject_code text,
  ADD COLUMN IF NOT EXISTS subject_name text;

CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON public.timetable_slots(teacher_id);

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
          AND (
            ts.teacher_id = t.id
            OR (
              ts.teacher_name IS NOT NULL
              AND lower(trim(ts.teacher_name)) IN (
                lower(trim(t.full_name)),
                lower(trim(coalesce(t.full_name_en, ''))),
                lower(trim(coalesce(t.full_name_km, ''))),
                lower(trim(t.staff_code))
              )
            )
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
        AND (
          ts.teacher_id = current_teacher.id
          OR (
            ts.teacher_name IS NOT NULL
            AND lower(trim(ts.teacher_name)) IN (
              lower(trim(current_teacher.full_name)),
              lower(trim(coalesce(current_teacher.full_name_en, ''))),
              lower(trim(coalesce(current_teacher.full_name_km, ''))),
              lower(trim(current_teacher.staff_code))
            )
          )
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
    ON ts.teacher_name IS NOT NULL
    AND lower(trim(ts.teacher_name)) IN (
      lower(trim(t.full_name)),
      lower(trim(coalesce(t.full_name_en, ''))),
      lower(trim(coalesce(t.full_name_km, ''))),
      lower(trim(t.staff_code))
    )
  WHERE ts.teacher_id IS NULL
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

NOTIFY pgrst, 'reload schema';
