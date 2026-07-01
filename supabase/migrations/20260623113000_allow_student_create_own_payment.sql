-- Allow student users to create a pending payment invoice for their own
-- student record. Admin payment management policies remain unchanged.

DROP POLICY IF EXISTS "Students create own payments" ON public.payments;

CREATE POLICY "Students create own payments"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'student')
    AND status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = student_id
        AND s.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
