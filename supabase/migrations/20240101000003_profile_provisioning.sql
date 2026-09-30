-- =============================================================================
-- Migration: profile auto-provisioning trigger
-- Automatically creates a profile when a new auth user is created.
-- Uses ON CONFLICT(id) DO NOTHING for idempotency.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _display_name TEXT;
BEGIN
  -- Try to extract display name from: metadata > email local part > fallback
  _display_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data ->> 'name'), ''),
    NULLIF(trim(split_part(COALESCE(NEW.email, ''), '@', 1)), ''),
    'User'
  );

  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, _display_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
