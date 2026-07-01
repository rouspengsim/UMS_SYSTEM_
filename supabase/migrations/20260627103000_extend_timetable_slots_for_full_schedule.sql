-- Store full printable schedule details in timetable_slots so schedules are visible
-- to admin, teacher, and student roles across devices.

ALTER TABLE public.timetable_slots
  ADD COLUMN IF NOT EXISTS shift text,
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
  ADD COLUMN IF NOT EXISTS right_signature text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON public.timetable_slots(teacher_id);
CREATE INDEX IF NOT EXISTS idx_timetable_class_day_time
  ON public.timetable_slots(class_id, day, start_time, end_time);

DROP TRIGGER IF EXISTS trg_timetable_slots_updated ON public.timetable_slots;
CREATE TRIGGER trg_timetable_slots_updated
  BEFORE UPDATE ON public.timetable_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
