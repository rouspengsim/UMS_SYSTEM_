-- Add Morning/Afternoon/Evening shift to student records.
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS shift TEXT;

COMMENT ON COLUMN public.students.shift IS 'Student study shift: morning, afternoon, or evening.';

NOTIFY pgrst, 'reload schema';
