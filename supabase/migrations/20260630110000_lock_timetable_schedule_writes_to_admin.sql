DROP POLICY IF EXISTS "Read timetable" ON public.timetable_slots;
DROP POLICY IF EXISTS "Admins manage timetable" ON public.timetable_slots;
DROP POLICY IF EXISTS "Admins insert timetable" ON public.timetable_slots;
DROP POLICY IF EXISTS "Admins update timetable" ON public.timetable_slots;
DROP POLICY IF EXISTS "Admins delete timetable" ON public.timetable_slots;
DROP POLICY IF EXISTS "Authenticated manage timetable" ON public.timetable_slots;
DROP POLICY IF EXISTS "Teachers manage timetable" ON public.timetable_slots;
DROP POLICY IF EXISTS "Students manage timetable" ON public.timetable_slots;

CREATE POLICY "Read timetable"
  ON public.timetable_slots
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins insert timetable"
  ON public.timetable_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update timetable"
  ON public.timetable_slots
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete timetable"
  ON public.timetable_slots
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

NOTIFY pgrst, 'reload schema';
