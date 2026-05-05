CREATE TABLE public.subject_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  semester TEXT NOT NULL DEFAULT 'Semester 1',
  week_number INTEGER NOT NULL DEFAULT 1,
  subject_code TEXT NOT NULL DEFAULT 'Subject 1',
  score NUMERIC(6,2),
  max_score NUMERIC(6,2) NOT NULL DEFAULT 100,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subject_scores_week_number_check CHECK (week_number BETWEEN 1 AND 48),
  CONSTRAINT subject_scores_score_check CHECK (score IS NULL OR score >= 0),
  UNIQUE (student_id, class_id, semester, week_number, subject_code)
);

ALTER TABLE public.subject_scores ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_subject_scores_updated BEFORE UPDATE ON public.subject_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_subject_scores_class_semester_week
  ON public.subject_scores(class_id, semester, week_number);

CREATE INDEX idx_subject_scores_student
  ON public.subject_scores(student_id);

CREATE POLICY "Read subject scores"
  ON public.subject_scores FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'teacher')
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );

CREATE POLICY "Teachers/admins manage subject scores"
  ON public.subject_scores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'));
