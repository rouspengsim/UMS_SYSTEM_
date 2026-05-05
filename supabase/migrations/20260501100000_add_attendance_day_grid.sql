ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS day_of_week INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT attendance_day_of_week_check CHECK (day_of_week BETWEEN 1 AND 7);

ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_student_class_week_subject_key;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_student_class_week_day_subject_key
  UNIQUE (student_id, class_id, semester, week_number, day_of_week, subject_code);

CREATE INDEX IF NOT EXISTS idx_attendance_class_semester_week_day
  ON public.attendance(class_id, semester, week_number, day_of_week);

ALTER TABLE public.teacher_attendance
  ADD COLUMN IF NOT EXISTS day_of_week INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT teacher_attendance_day_of_week_check CHECK (day_of_week BETWEEN 1 AND 7);

ALTER TABLE public.teacher_attendance
  DROP CONSTRAINT IF EXISTS teacher_attendance_teacher_week_subject_key;

ALTER TABLE public.teacher_attendance
  ADD CONSTRAINT teacher_attendance_teacher_week_day_subject_key
  UNIQUE (teacher_id, semester, week_number, day_of_week, subject_code);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_semester_week_day
  ON public.teacher_attendance(semester, week_number, day_of_week);
