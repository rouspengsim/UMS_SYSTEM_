-- Create an admin-visible notification whenever a student or teacher signs up.
-- The app uses this as the approval alert for newly registered users.
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
  display_name TEXT;
BEGIN
  display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (user_id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    display_name,
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

  IF assigned_role IN ('student', 'teacher') THEN
    INSERT INTO public.notifications (target_user_id, title, body, kind, created_by)
    VALUES (
      NULL,
      'New ' || assigned_role::text || ' signup needs approval',
      display_name || ' (' || COALESCE(NEW.email, 'no email') || ') created an account. Review and complete their profile before approving access.',
      'warning',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;
