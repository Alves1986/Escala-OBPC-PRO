-- Detect duplicate memberships by tenant scope
SELECT organization_id, ministry_id, profile_id, COUNT(*) AS total
FROM public.organization_memberships
GROUP BY organization_id, ministry_id, profile_id
HAVING COUNT(*) > 1;

-- Remove duplicates keeping the oldest row (smallest created_at, fallback smallest id)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, ministry_id, profile_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.organization_memberships
)
DELETE FROM public.organization_memberships om
USING ranked r
WHERE om.id = r.id
  AND r.rn > 1;

-- Ensure unique tenant+ministry+profile membership
ALTER TABLE public.organization_memberships
  ADD CONSTRAINT IF NOT EXISTS organization_memberships_org_ministry_profile_uniq
  UNIQUE (organization_id, ministry_id, profile_id);
