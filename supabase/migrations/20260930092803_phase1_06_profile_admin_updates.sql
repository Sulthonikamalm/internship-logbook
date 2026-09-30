-- Service role and postgres may perform trusted profile administration.
-- The original trigger also rejected service-role updates, despite bypassing RLS.
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres') THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.is_active IS DISTINCT FROM OLD.is_active
    OR NEW.content_read_all IS DISTINCT FROM OLD.content_read_all THEN
    RAISE EXCEPTION 'Cannot modify privileged profile fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';
