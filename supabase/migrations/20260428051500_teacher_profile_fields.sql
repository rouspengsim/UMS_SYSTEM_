-- Add teacher profile fields used by the teacher cards and create form.
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS full_name_km TEXT,
  ADD COLUMN IF NOT EXISTS full_name_en TEXT,
  ADD COLUMN IF NOT EXISTS faculty TEXT;

UPDATE public.teachers
SET full_name_en = COALESCE(full_name_en, full_name)
WHERE full_name_en IS NULL;

UPDATE public.teachers
SET faculty = COALESCE(faculty, department)
WHERE faculty IS NULL;

NOTIFY pgrst, 'reload schema';
