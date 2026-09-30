-- =============================================================================
-- Migration: profiles RLS policies
--
-- SELECT: user reads own profile only
-- UPDATE: user can only update display_name and timezone
--         role, is_active, content_read_all are protected via trigger
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: user reads own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- UPDATE: user can update own row
-- Field-level protection via trigger below (RLS row policy is insufficient)
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =============================================================================
-- Trigger: prevent self-edit of privileged fields
-- Blocks changes to role, is_active, content_read_all from non-service-role.
-- Service role bypasses RLS entirely, so admin operations work normally.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- If any protected field changed, reject the update
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Cannot modify role field'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Cannot modify is_active field'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.content_read_all IS DISTINCT FROM OLD.content_read_all THEN
    RAISE EXCEPTION 'Cannot modify content_read_all field'
      USING ERRCODE = '42501';
  END IF;

  -- Also prevent id changes (just in case)
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Cannot modify id field'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_profiles_privileged_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();
