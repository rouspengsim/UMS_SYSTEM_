

CREATE OR REPLACE FUNCTION public.current_student_class(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT class_name
  FROM public.students
  WHERE user_id = _user_id
  LIMIT 1
$$;

DROP POLICY IF EXISTS "Students read same class" ON public.students;

CREATE POLICY "Students read same class"
  ON public.students FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'student')
    AND class_name IS NOT NULL
    AND class_name = public.current_student_class(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.list_student_classmates()
RETURNS SETOF public.students
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT classmate.*
  FROM public.students own_student
  JOIN public.students classmate
    ON classmate.class_name = own_student.class_name
  WHERE own_student.user_id = auth.uid()
    AND own_student.class_name IS NOT NULL
  ORDER BY classmate.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.current_student_class(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_student_classmates() TO authenticated;
