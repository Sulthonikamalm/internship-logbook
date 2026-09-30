-- =============================================================================
-- Migration: set_updated_at trigger function
-- Reusable function for any table with an updated_at column.
-- Server/DB timestamp is authoritative.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
