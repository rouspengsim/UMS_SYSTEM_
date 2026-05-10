ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS place_of_birth TEXT,
  ADD COLUMN IF NOT EXISTS father_name TEXT,
  ADD COLUMN IF NOT EXISTS father_job TEXT,
  ADD COLUMN IF NOT EXISTS mother_name TEXT,
  ADD COLUMN IF NOT EXISTS mother_job TEXT,
  ADD COLUMN IF NOT EXISTS academic TEXT,
  ADD COLUMN IF NOT EXISTS student_type TEXT,
  ADD COLUMN IF NOT EXISTS pay_year1 TEXT NOT NULL DEFAULT 'not_yet',
  ADD COLUMN IF NOT EXISTS pay_year2 TEXT NOT NULL DEFAULT 'not_yet',
  ADD COLUMN IF NOT EXISTS pay_year3 TEXT NOT NULL DEFAULT 'not_yet',
  ADD COLUMN IF NOT EXISTS pay_year4 TEXT NOT NULL DEFAULT 'not_yet';

UPDATE public.students
SET nationality = COALESCE(nationality, 'Khmer')
WHERE nationality IS NULL;

NOTIFY pgrst, 'reload schema';
