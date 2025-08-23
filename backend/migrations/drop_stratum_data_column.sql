-- Migration: Drop stratum_data column from borelog_details and borelog_versions
-- Date: 2025-08-18

BEGIN;

-- Drop from final details table if exists
ALTER TABLE IF EXISTS borelog_details 
DROP COLUMN IF EXISTS stratum_data;

-- Drop from versions (staging) table if exists
ALTER TABLE IF EXISTS borelog_versions 
DROP COLUMN IF EXISTS stratum_data;

COMMIT;





