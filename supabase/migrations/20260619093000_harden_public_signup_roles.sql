CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role TEXT;
  assigned_role public.app_role;
BEGIN
  requested_role := NEW.raw_user_meta_data->>'role';
  assigned_role := CASE
    WHEN requested_role = 'teacher' THEN 'teacher'::public.app_role
    ELSE 'student'::public.app_role
  END;

  INSERT INTO public.profiles (user_id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.user_roles
  WHERE user_id = NEW.id
    AND role = 'admin';

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_client_admin_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
    AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  THEN
    IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.role = 'admin' THEN
      RAISE EXCEPTION 'Admin roles can only be managed from trusted database operations.';
    END IF;

    IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.role = 'admin' THEN
      RAISE EXCEPTION 'Admin roles can only be managed from trusted database operations.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_client_admin_role_changes ON public.user_roles;
CREATE TRIGGER trg_prevent_client_admin_role_changes
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_client_admin_role_changes();
