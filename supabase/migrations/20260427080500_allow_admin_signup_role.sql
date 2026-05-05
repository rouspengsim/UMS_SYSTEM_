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
