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

GRANT EXECUTE ON FUNCTION public.timetable_slot_matches_teacher(text, uuid, text, uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_read_class(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_teacher_classes() TO authenticated;

NOTIFY pgrst, 'reload schema';
