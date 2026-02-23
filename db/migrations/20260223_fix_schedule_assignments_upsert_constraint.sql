-- Fix 42P10 for schedule assignments upsert
-- Canonical conflict target used by app:
-- organization_id, ministry_id, event_rule_id, event_date, role

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'schedule_assignments_unique'
  ) THEN
    ALTER TABLE public.schedule_assignments
    ADD CONSTRAINT schedule_assignments_unique
    UNIQUE (organization_id, ministry_id, event_rule_id, event_date, role);
  END IF;
END $$;
