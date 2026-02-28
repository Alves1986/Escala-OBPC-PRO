-- Optional helper function for auto-membership when a new profile is created.
-- This script is provided for review and should NOT be executed automatically.

CREATE OR REPLACE FUNCTION public.ensure_default_membership_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.organization_id IS NULL OR NEW.ministry_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.organization_memberships (
    organization_id,
    ministry_id,
    profile_id,
    role,
    functions
  ) VALUES (
    NEW.organization_id,
    NEW.ministry_id,
    NEW.id,
    'member',
    '[]'::jsonb
  )
  ON CONFLICT (organization_id, ministry_id, profile_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_auto_membership ON public.profiles;
CREATE TRIGGER trg_profiles_auto_membership
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_default_membership_from_profile();
