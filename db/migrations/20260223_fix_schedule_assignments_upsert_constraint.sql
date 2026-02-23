-- Step 1 (inspection query to run before/after migration):
-- SELECT c.conname, pg_get_constraintdef(c.oid)
-- FROM pg_constraint c
-- JOIN pg_class t ON c.conrelid = t.oid
-- WHERE t.relname = 'schedule_assignments';

-- Step 2 (definitive fix for 42P10):
-- Ensure UNIQUE exactly on (organization_id, ministry_id, event_rule_id, event_date, role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'schedule_assignments'
      AND c.contype = 'u'
      AND c.conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'organization_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'ministry_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'event_rule_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'event_date'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'role')
      ]::smallint[]
  ) THEN
    ALTER TABLE public.schedule_assignments
    ADD CONSTRAINT schedule_assignments_unique
    UNIQUE (organization_id, ministry_id, event_rule_id, event_date, role);
  END IF;
END $$;
