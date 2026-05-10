
-- =====================================================
-- supabase/migrations/20260423025739_71e11be6-cadd-4cb4-bd74-3b1eda8b468e.sql
-- =====================================================

-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');
CREATE TYPE public.student_status AS ENUM ('active', 'inactive', 'graduated', 'suspended');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled');
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'bank_transfer', 'mobile');
CREATE TYPE public.exam_type AS ENUM ('quiz', 'midterm', 'final', 'assignment', 'project');
CREATE TYPE public.notification_kind AS ENUM ('info', 'warning', 'success', 'announcement');
CREATE TYPE public.certificate_kind AS ENUM ('completion', 'graduation', 'award', 'participation');
CREATE TYPE public.certificate_status AS ENUM ('draft', 'issued', 'revoked');
CREATE TYPE public.weekday AS ENUM ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');

-- =====================================================
-- UTILITY: updated_at trigger function
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- PROFILES
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- USER ROLES
-- =====================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role check (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- =====================================================
-- AUTO-CREATE PROFILE + ROLE ON SIGNUP
-- First user becomes admin, others become student.
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  SELECT count(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'student';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- STUDENTS
-- =====================================================
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  student_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT,
  address TEXT,
  enrollment_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  status public.student_status NOT NULL DEFAULT 'active',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_students_user_id ON public.students(user_id);

-- =====================================================
-- TEACHERS
-- =====================================================
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department TEXT,
  specialization TEXT,
  hire_date DATE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_teachers_updated BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_teachers_user_id ON public.teachers(user_id);

-- =====================================================
-- CLASSES
-- =====================================================
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  description TEXT,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  room TEXT,
  semester TEXT,
  academic_year TEXT,
  capacity INT NOT NULL DEFAULT 40,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_classes_updated BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_classes_teacher_id ON public.classes(teacher_id);

-- =====================================================
-- ENROLLMENTS
-- =====================================================
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, class_id)
);
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_enrollments_class ON public.enrollments(class_id);
CREATE INDEX idx_enrollments_student ON public.enrollments(student_id);

-- =====================================================
-- ATTENDANCE
-- =====================================================
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'present',
  note TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, class_id, date)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_attendance_class_date ON public.attendance(class_id, date);
CREATE INDEX idx_attendance_student ON public.attendance(student_id);

-- =====================================================
-- EXAMS
-- =====================================================
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  exam_type public.exam_type NOT NULL DEFAULT 'quiz',
  exam_date DATE,
  max_score NUMERIC(6,2) NOT NULL DEFAULT 100,
  weight NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_exams_updated BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_exams_class ON public.exams(class_id);

-- =====================================================
-- SCORES
-- =====================================================
CREATE TABLE public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  score NUMERIC(6,2),
  remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_id, student_id)
);
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_scores_updated BEFORE UPDATE ON public.scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_scores_exam ON public.scores(exam_id);
CREATE INDEX idx_scores_student ON public.scores(student_id);

-- =====================================================
-- TIMETABLE
-- =====================================================
CREATE TABLE public.timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  day public.weekday NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_timetable_class ON public.timetable_slots(class_id);

-- =====================================================
-- PAYMENTS
-- =====================================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  due_date DATE,
  paid_date DATE,
  status public.payment_status NOT NULL DEFAULT 'pending',
  method public.payment_method,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_payments_student ON public.payments(student_id);
CREATE INDEX idx_payments_status ON public.payments(status);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  kind public.notification_kind NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_target ON public.notifications(target_user_id);

-- =====================================================
-- CERTIFICATES
-- =====================================================
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  kind public.certificate_kind NOT NULL DEFAULT 'completion',
  title TEXT NOT NULL,
  description TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  verification_code TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  file_url TEXT,
  status public.certificate_status NOT NULL DEFAULT 'issued',
  issued_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_certificates_updated BEFORE UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_certificates_student ON public.certificates(student_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- profiles: everyone signed in can read all profiles (needed for class lists, teacher names),
-- users update only their own
CREATE POLICY "Profiles readable by authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_roles: user can read own roles; admins manage all
CREATE POLICY "Users read own roles"
  ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all roles"
  ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- students
CREATE POLICY "Authenticated read students"
  ON public.students FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'teacher')
    OR auth.uid() = user_id
  );
CREATE POLICY "Admins manage students"
  ON public.students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- teachers
CREATE POLICY "Authenticated read teachers"
  ON public.teachers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage teachers"
  ON public.teachers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers update own"
  ON public.teachers FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- classes
CREATE POLICY "Authenticated read classes"
  ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage classes"
  ON public.classes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- enrollments
CREATE POLICY "Authenticated read enrollments"
  ON public.enrollments FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'teacher')
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );
CREATE POLICY "Admins manage enrollments"
  ON public.enrollments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- attendance
CREATE POLICY "Read attendance"
  ON public.attendance FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'teacher')
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );
CREATE POLICY "Teachers/admins manage attendance"
  ON public.attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'));

-- exams
CREATE POLICY "Read exams"
  ON public.exams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers/admins manage exams"
  ON public.exams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'));

-- scores
CREATE POLICY "Read scores"
  ON public.scores FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'teacher')
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );
CREATE POLICY "Teachers/admins manage scores"
  ON public.scores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'));

-- timetable
CREATE POLICY "Read timetable"
  ON public.timetable_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage timetable"
  ON public.timetable_slots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- payments
CREATE POLICY "Read payments"
  ON public.payments FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );
CREATE POLICY "Admins manage payments"
  ON public.payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- notifications
CREATE POLICY "Read notifications"
  ON public.notifications FOR SELECT TO authenticated USING (
    target_user_id IS NULL OR target_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Users mark own as read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (target_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- certificates
CREATE POLICY "Read certificates"
  ON public.certificates FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'teacher')
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );
CREATE POLICY "Admins manage certificates"
  ON public.certificates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- supabase/migrations/20260423071000_honor_signup_role_for_new_users.sql
-- =====================================================
-- Honor the requested signup role for non-first users while preserving
-- the bootstrap rule that the first account becomes admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
  requested_role TEXT;
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  SELECT count(*) INTO user_count FROM public.user_roles;
  requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');

  IF user_count = 0 THEN
    assigned_role := 'admin';
  ELSIF requested_role = 'teacher' THEN
    assigned_role := 'teacher';
  ELSE
    assigned_role := 'student';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;

-- =====================================================
-- supabase/migrations/20260427080500_allow_admin_signup_role.sql
-- =====================================================
-- Keep public signup safe: only the first account becomes admin.
-- Later users can request student or teacher; admins must be assigned by an existing admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
  requested_role TEXT;
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  SELECT count(*) INTO user_count FROM public.user_roles;
  requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');

  IF user_count = 0 THEN
    assigned_role := 'admin';
  ELSIF requested_role = 'teacher' THEN
    assigned_role := 'teacher';
  ELSE
    assigned_role := 'student';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;

-- =====================================================
-- supabase/migrations/20260427083000_seed_admin_account.sql
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  admin_email CONSTANT TEXT := 'admin@gmail.com';
  admin_password CONSTANT TEXT := 'Admin@123';
  admin_name CONSTANT TEXT := 'Admin';
  admin_user_id UUID;
BEGIN
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE lower(email) = lower(admin_email)
  ORDER BY created_at
  LIMIT 1;

  IF admin_user_id IS NULL THEN
    admin_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_user_id,
      'authenticated',
      'authenticated',
      admin_email,
      extensions.crypt(admin_password, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('full_name', admin_name, 'role', 'admin'),
      now(),
      now()
    );
  ELSE
    UPDATE auth.users
    SET
      email = admin_email,
      encrypted_password = extensions.crypt(admin_password, extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) ||
        jsonb_build_object('full_name', admin_name, 'role', 'admin'),
      updated_at = now()
    WHERE id = admin_user_id;
  END IF;

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    admin_user_id,
    admin_user_id::text,
    jsonb_build_object(
      'sub', admin_user_id::text,
      'email', admin_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider_id, provider) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    identity_data = EXCLUDED.identity_data,
    updated_at = now();

  INSERT INTO public.profiles (user_id, full_name, email, avatar_url)
  VALUES (admin_user_id, admin_name, admin_email, NULL)
  ON CONFLICT (user_id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.user_roles
  WHERE user_id = admin_user_id
    AND role <> 'admin';
END;
$$;

-- =====================================================
-- supabase/migrations/20260428040500_fix_admin_seed_login.sql
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  admin_email CONSTANT TEXT := 'admin@gmail.com';
  admin_password CONSTANT TEXT := 'Admin@123';
  admin_name CONSTANT TEXT := 'Admin';
  admin_user_id UUID;
BEGIN
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE lower(email) = lower(admin_email)
  ORDER BY created_at
  LIMIT 1;

  IF admin_user_id IS NULL THEN
    admin_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_user_id,
      'authenticated',
      'authenticated',
      admin_email,
      extensions.crypt(admin_password, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('full_name', admin_name, 'role', 'admin'),
      now(),
      now()
    );
  ELSE
    UPDATE auth.users
    SET
      email = admin_email,
      encrypted_password = extensions.crypt(admin_password, extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) ||
        jsonb_build_object('full_name', admin_name, 'role', 'admin'),
      updated_at = now()
    WHERE id = admin_user_id;
  END IF;

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    admin_user_id,
    admin_user_id::text,
    jsonb_build_object(
      'sub', admin_user_id::text,
      'email', admin_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider_id, provider) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    identity_data = EXCLUDED.identity_data,
    updated_at = now();

  INSERT INTO public.profiles (user_id, full_name, email, avatar_url)
  VALUES (admin_user_id, admin_name, admin_email, NULL)
  ON CONFLICT (user_id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.user_roles
  WHERE user_id = admin_user_id
    AND role <> 'admin';
END;
$$;

-- =====================================================
-- supabase/migrations/20260428043000_student_profile_fields.sql
-- =====================================================
-- Add student profile fields used by the student create form.
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

-- =====================================================
-- supabase/migrations/20260428051500_teacher_profile_fields.sql
-- =====================================================
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

-- =====================================================
-- supabase/migrations/20260428053500_add_student_shift.sql
-- =====================================================
-- Add Morning/Afternoon/Evening shift to student records.
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS shift TEXT;

COMMENT ON COLUMN public.students.shift IS 'Student study shift: morning, afternoon, or evening.';

NOTIFY pgrst, 'reload schema';

-- =====================================================
-- supabase/migrations/20260501090000_add_teacher_attendance.sql
-- =====================================================
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

-- =====================================================
-- supabase/migrations/20260501093000_add_semester_subject_attendance.sql
-- =====================================================
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS semester TEXT NOT NULL DEFAULT 'Semester 1',
  ADD COLUMN IF NOT EXISTS week_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS subject_code TEXT NOT NULL DEFAULT 'Subject 1',
  ADD CONSTRAINT attendance_week_number_check CHECK (week_number BETWEEN 1 AND 48);

ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_student_id_class_id_date_key;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_student_class_week_subject_key
  UNIQUE (student_id, class_id, semester, week_number, subject_code);

CREATE INDEX IF NOT EXISTS idx_attendance_class_semester_week
  ON public.attendance(class_id, semester, week_number);

ALTER TABLE public.teacher_attendance
  ADD COLUMN IF NOT EXISTS semester TEXT NOT NULL DEFAULT 'Semester 1',
  ADD COLUMN IF NOT EXISTS week_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS subject_code TEXT NOT NULL DEFAULT 'Subject 1',
  ADD CONSTRAINT teacher_attendance_week_number_check CHECK (week_number BETWEEN 1 AND 48);

ALTER TABLE public.teacher_attendance
  DROP CONSTRAINT IF EXISTS teacher_attendance_teacher_id_date_key;

ALTER TABLE public.teacher_attendance
  ADD CONSTRAINT teacher_attendance_teacher_week_subject_key
  UNIQUE (teacher_id, semester, week_number, subject_code);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_semester_week
  ON public.teacher_attendance(semester, week_number);

-- =====================================================
-- supabase/migrations/20260501100000_add_attendance_day_grid.sql
-- =====================================================
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS day_of_week INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT attendance_day_of_week_check CHECK (day_of_week BETWEEN 1 AND 7);

ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_student_class_week_subject_key;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_student_class_week_day_subject_key
  UNIQUE (student_id, class_id, semester, week_number, day_of_week, subject_code);

CREATE INDEX IF NOT EXISTS idx_attendance_class_semester_week_day
  ON public.attendance(class_id, semester, week_number, day_of_week);

ALTER TABLE public.teacher_attendance
  ADD COLUMN IF NOT EXISTS day_of_week INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT teacher_attendance_day_of_week_check CHECK (day_of_week BETWEEN 1 AND 7);

ALTER TABLE public.teacher_attendance
  DROP CONSTRAINT IF EXISTS teacher_attendance_teacher_week_subject_key;

ALTER TABLE public.teacher_attendance
  ADD CONSTRAINT teacher_attendance_teacher_week_day_subject_key
  UNIQUE (teacher_id, semester, week_number, day_of_week, subject_code);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_semester_week_day
  ON public.teacher_attendance(semester, week_number, day_of_week);

-- =====================================================
-- supabase/migrations/20260501103000_add_subject_scores.sql
-- =====================================================
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

-- =====================================================
-- supabase/migrations/20260509120000_add_subjects.sql
-- =====================================================
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

-- =====================================================
-- supabase/migrations/20260509123000_add_student_information_fields.sql
-- =====================================================
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
