-- Track daily attendance for teachers separately from class/student attendance.
CREATE TABLE public.teacher_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'present',
  note TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, date)
);

ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_teacher_attendance_date ON public.teacher_attendance(date);
CREATE INDEX idx_teacher_attendance_teacher ON public.teacher_attendance(teacher_id);

CREATE POLICY "Read teacher attendance"
  ON public.teacher_attendance FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'teacher')
    OR EXISTS (
      SELECT 1
      FROM public.teachers t
      WHERE t.id = teacher_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage teacher attendance"
  ON public.teacher_attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
