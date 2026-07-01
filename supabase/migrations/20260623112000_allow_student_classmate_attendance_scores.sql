-- Allow student users to read attendance and score records for classmates
-- in their own class. This keeps write access limited to admins/teachers.

CREATE OR REPLACE FUNCTION public.student_in_current_class(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students own_student
    JOIN public.students classmate
      ON classmate.class_name = own_student.class_name
    WHERE own_student.user_id = auth.uid()
      AND own_student.class_name IS NOT NULL
      AND classmate.id = _student_id
  )
$$;

DROP POLICY IF EXISTS "Students read same class attendance" ON public.attendance;
CREATE POLICY "Students read same class attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'student')
    AND public.student_in_current_class(student_id)
  );

DROP POLICY IF EXISTS "Students read same class scores" ON public.scores;
CREATE POLICY "Students read same class scores"
  ON public.scores FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'student')
    AND public.student_in_current_class(student_id)
  );

DROP POLICY IF EXISTS "Students read same class subject scores" ON public.subject_scores;
CREATE POLICY "Students read same class subject scores"
  ON public.subject_scores FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'student')
    AND public.student_in_current_class(student_id)
  );

GRANT EXECUTE ON FUNCTION public.student_in_current_class(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
