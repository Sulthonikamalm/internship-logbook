-- =============================================================================
-- Migration: profiles table
-- Core identity table linked 1:1 to auth.users.
-- Stores role, active status, timezone, and display name.
-- =============================================================================

CREATE TABLE public.profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT        NOT NULL
                            CONSTRAINT profiles_display_name_not_empty
                            CHECK (length(trim(display_name)) > 0),
  role          TEXT        NOT NULL DEFAULT 'user'
                            CONSTRAINT profiles_role_valid
                            CHECK (role IN ('user', 'supervisor', 'admin')),
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  timezone      TEXT        NOT NULL DEFAULT 'Asia/Jakarta',
  content_read_all BOOLEAN  NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comment on table
COMMENT ON TABLE public.profiles IS
  'User profile data linked 1:1 with auth.users. Source of truth for role, active status, and preferences.';

-- Auto-update updated_at
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
