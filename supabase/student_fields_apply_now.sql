-- Run this in Supabase SQL Editor if Add Student fails with:
-- "Could not find the 'class_name' column of 'students' in the schema cache"
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS full_name_km TEXT,
  ADD COLUMN IF NOT EXISTS full_name_en TEXT,
  ADD COLUMN IF NOT EXISTS study_year INT,
  ADD COLUMN IF NOT EXISTS class_name TEXT,
  ADD COLUMN IF NOT EXISTS major TEXT;

UPDATE public.students
SET full_name_en = COALESCE(full_name_en, full_name)
WHERE full_name_en IS NULL;

NOTIFY pgrst, 'reload schema';
