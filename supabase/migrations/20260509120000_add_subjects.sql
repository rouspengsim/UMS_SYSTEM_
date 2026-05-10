CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id TEXT NOT NULL UNIQUE,
  subject_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_subjects_updated ON public.subjects;
CREATE TRIGGER trg_subjects_updated BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_subjects_subject_id ON public.subjects(subject_id);

CREATE POLICY "Authenticated read subjects"
  ON public.subjects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage subjects"
  ON public.subjects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.subjects (subject_id, subject_name, description)
VALUES
  ('General_Culture', 'General Culture', NULL),
  ('C_Programming', 'C Programming', NULL),
  ('Multimedia_and_Design_1', 'Multimedia and Design 1', NULL),
  ('Political_Economics', 'Political Economics', NULL),
  ('Mathematics', 'Mathematics', NULL),
  ('Statistics', 'Statistics', NULL),
  ('Microsoft_Office', 'Microsoft Office', NULL),
  ('Multimedia_and_Design_2', 'Multimedia and Design 2', NULL),
  ('English_1', 'English 1', NULL),
  ('English_2', 'English 2', NULL)
ON CONFLICT (subject_id) DO NOTHING;

INSERT INTO public.subjects (subject_id, subject_name, description)
SELECT DISTINCT
  classes.subject_code,
  classes.subject_code,
  'Imported from existing classes'
FROM public.classes
WHERE classes.subject_code IS NOT NULL AND btrim(classes.subject_code) <> ''
ON CONFLICT (subject_id) DO NOTHING;
