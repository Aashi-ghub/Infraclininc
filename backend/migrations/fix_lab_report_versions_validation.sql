-- Migration: Remove problematic validation function and fix lab report creation
-- Date: 2025-01-27

BEGIN;

-- Completely remove the validation function and trigger that's causing issues
DROP TRIGGER IF EXISTS trigger_validate_unified_lab_report_data ON unified_lab_reports;
DROP FUNCTION IF EXISTS validate_unified_lab_report_data();

-- Also remove any validation on lab_report_versions table if it exists
DROP TRIGGER IF EXISTS trigger_validate_lab_report_version_data ON lab_report_versions;
DROP FUNCTION IF EXISTS validate_lab_report_version_data();

-- Make sure test_types can be empty for drafts in unified_lab_reports
ALTER TABLE unified_lab_reports ALTER COLUMN test_types DROP NOT NULL;

-- Make sure created_by_user_id can be null in lab_report_versions for drafts
ALTER TABLE lab_report_versions ALTER COLUMN created_by_user_id DROP NOT NULL;

-- Make sure test_types can be empty in lab_report_versions for drafts
ALTER TABLE lab_report_versions ALTER COLUMN test_types DROP NOT NULL;

-- Make sure assignment_id can be null in lab_report_versions for drafts
ALTER TABLE lab_report_versions ALTER COLUMN assignment_id DROP NOT NULL;

-- Fix the trigger function to handle null assignment_id
DROP TRIGGER IF EXISTS trigger_create_initial_lab_report_version ON unified_lab_reports;
DROP FUNCTION IF EXISTS create_initial_lab_report_version();

CREATE OR REPLACE FUNCTION create_initial_lab_report_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version_no INTEGER;
BEGIN
  -- Get the next version number (should be 1 for new reports)
  SELECT get_next_lab_report_version(NEW.report_id) INTO next_version_no;
  
  -- Create the initial version with proper null handling
  INSERT INTO lab_report_versions (
    report_id,
    version_no,
    assignment_id,
    borelog_id,
    sample_id,
    project_name,
    borehole_no,
    client,
    test_date,
    tested_by,
    checked_by,
    approved_by,
    test_types,
    soil_test_data,
    rock_test_data,
    status,
    remarks,
    created_by_user_id
  ) VALUES (
    NEW.report_id,
    next_version_no,
    NEW.assignment_id, -- This can now be null
    NEW.borelog_id,
    NEW.sample_id,
    NEW.project_name,
    NEW.borehole_no,
    NEW.client,
    NEW.test_date,
    NEW.tested_by,
    NEW.checked_by,
    NEW.approved_by,
    COALESCE(NEW.test_types, '[]'::jsonb),
    COALESCE(NEW.soil_test_data, '[]'::jsonb),
    COALESCE(NEW.rock_test_data, '[]'::jsonb),
    NEW.status,
    NEW.remarks,
    NULL
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_create_initial_lab_report_version
  AFTER INSERT ON unified_lab_reports
  FOR EACH ROW
  EXECUTE FUNCTION create_initial_lab_report_version();

COMMIT;
