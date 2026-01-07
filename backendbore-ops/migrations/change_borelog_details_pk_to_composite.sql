-- Migration: Change primary key of borelog_details to composite (borelog_id, version_no)
-- Purpose: Allow multiple versions per borelog without primary key conflicts
-- Date: 2025-08-18

BEGIN;

-- Ensure version_no exists and is populated
ALTER TABLE borelog_details ADD COLUMN IF NOT EXISTS version_no INTEGER DEFAULT 1;
UPDATE borelog_details SET version_no = 1 WHERE version_no IS NULL;
ALTER TABLE borelog_details ALTER COLUMN version_no SET NOT NULL;

-- Drop existing primary key on (borelog_id)
ALTER TABLE borelog_details DROP CONSTRAINT IF EXISTS borelog_details_pkey;

-- Drop previous unique constraint if it exists (will be enforced by the new PK)
ALTER TABLE borelog_details DROP CONSTRAINT IF EXISTS unique_borelog_version;

-- Add composite primary key
ALTER TABLE borelog_details ADD CONSTRAINT borelog_details_pkey PRIMARY KEY (borelog_id, version_no);

-- Helpful index for lookups by borelog_id (keeps performance similar to old PK)
CREATE INDEX IF NOT EXISTS idx_borelog_details_borelog_id ON borelog_details (borelog_id);

COMMIT;


