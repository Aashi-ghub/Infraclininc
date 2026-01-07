-- Migration: Fix percentage field precision in stratum_sample_points table
-- Date: 2025-08-18

BEGIN;

-- Update percentage fields to allow larger values
ALTER TABLE stratum_sample_points 
ALTER COLUMN tcr_percent TYPE DECIMAL(10,2),
ALTER COLUMN rqd_percent TYPE DECIMAL(10,2);

COMMIT;




