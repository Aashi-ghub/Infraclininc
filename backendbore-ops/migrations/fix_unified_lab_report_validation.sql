-- Migration: Fix unified lab report validation function
-- Date: 2025-01-27

BEGIN;

-- Make assignment_id nullable to allow drafts without formal assignments
ALTER TABLE unified_lab_reports ALTER COLUMN assignment_id DROP NOT NULL;

-- Completely drop the existing trigger and function
DROP TRIGGER IF EXISTS trigger_validate_unified_lab_report_data ON unified_lab_reports;
DROP FUNCTION IF EXISTS validate_unified_lab_report_data();

-- Create a completely new validation function
CREATE OR REPLACE FUNCTION validate_unified_lab_report_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure test_types is not null and is a valid JSONB array
  IF NEW.test_types IS NULL OR jsonb_typeof(NEW.test_types) != 'array' THEN
    RAISE EXCEPTION 'test_types must be a valid JSONB array';
  END IF;
  
  -- For drafts, allow empty test types (user is just saving progress)
  -- For submitted/approved reports, require at least one test type
  IF NEW.status != 'draft' AND jsonb_array_length(NEW.test_types) = 0 THEN
    RAISE EXCEPTION 'At least one test type must be specified for submitted/approved reports';
  END IF;
  
  -- Ensure soil_test_data is not null and is a valid JSONB array
  IF NEW.soil_test_data IS NULL OR jsonb_typeof(NEW.soil_test_data) != 'array' THEN
    RAISE EXCEPTION 'soil_test_data must be a valid JSONB array';
  END IF;
  
  -- Ensure rock_test_data is not null and is a valid JSONB array
  IF NEW.rock_test_data IS NULL OR jsonb_typeof(NEW.rock_test_data) != 'array' THEN
    RAISE EXCEPTION 'rock_test_data must be a valid JSONB array';
  END IF;
  
  -- Ensure soil test data is provided if Soil is in test_types (only for non-draft status)
  IF NEW.status != 'draft' AND NEW.test_types ? 'Soil' AND jsonb_array_length(NEW.soil_test_data) = 0 THEN
    RAISE EXCEPTION 'Soil test data must be provided when Soil is in test_types';
  END IF;
  
  -- Ensure rock test data is provided if Rock is in test_types (only for non-draft status)
  IF NEW.status != 'draft' AND NEW.test_types ? 'Rock' AND jsonb_array_length(NEW.rock_test_data) = 0 THEN
    RAISE EXCEPTION 'Rock test data must be provided when Rock is in test_types';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a completely new trigger
CREATE TRIGGER trigger_validate_unified_lab_report_data
  BEFORE INSERT OR UPDATE ON unified_lab_reports
  FOR EACH ROW
  EXECUTE FUNCTION validate_unified_lab_report_data();

COMMIT;
