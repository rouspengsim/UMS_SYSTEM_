ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS semester TEXT NOT NULL DEFAULT 'Semester 1',
  ADD COLUMN IF NOT EXISTS week_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS subject_code TEXT NOT NULL DEFAULT 'Subject 1',
  ADD CONSTRAINT attendance_week_number_check CHECK (week_number BETWEEN 1 AND 48);

ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_student_id_class_id_date_key;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_student_class_week_subject_key
  UNIQUE (student_id, class_id, semester, week_number, subject_code);

CREATE INDEX IF NOT EXISTS idx_attendance_class_semester_week
  ON public.attendance(class_id, semester, week_number);

ALTER TABLE public.teacher_attendance
  ADD COLUMN IF NOT EXISTS semester TEXT NOT NULL DEFAULT 'Semester 1',
  ADD COLUMN IF NOT EXISTS week_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS subject_code TEXT NOT NULL DEFAULT 'Subject 1',
  ADD CONSTRAINT teacher_attendance_week_number_check CHECK (week_number BETWEEN 1 AND 48);

ALTER TABLE public.teacher_attendance
  DROP CONSTRAINT IF EXISTS teacher_attendance_teacher_id_date_key;

ALTER TABLE public.teacher_attendance
  ADD CONSTRAINT teacher_attendance_teacher_week_subject_key
  UNIQUE (teacher_id, semester, week_number, subject_code);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_semester_week
  ON public.teacher_attendance(semester, week_number);
