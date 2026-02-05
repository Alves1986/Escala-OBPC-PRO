ALTER TABLE organization_ministries
  ADD COLUMN IF NOT EXISTS availability_start timestamptz,
  ADD COLUMN IF NOT EXISTS availability_end timestamptz;
