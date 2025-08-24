-- Migration: Remove lab_test_results table (redundant with unified_lab_reports)
-- Date: 2025-01-27

BEGIN;

-- Drop any triggers on lab_test_results table
DROP TRIGGER IF EXISTS trigger_validate_lab_test_result_data ON lab_test_results;
DROP TRIGGER IF EXISTS trigger_create_lab_test_result_version ON lab_test_results;

-- Drop any functions related to lab_test_results
DROP FUNCTION IF EXISTS validate_lab_test_result_data();
DROP FUNCTION IF EXISTS create_lab_test_result_version();

-- Drop the lab_test_results table
DROP TABLE IF EXISTS lab_test_results CASCADE;

COMMIT;
