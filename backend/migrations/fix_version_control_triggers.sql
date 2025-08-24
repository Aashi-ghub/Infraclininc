-- Migration: Fix version control triggers to properly update unified_lab_reports from lab_report_versions
-- Date: 2025-01-27

BEGIN;

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS trigger_create_initial_lab_report_version ON unified_lab_reports;
DROP TRIGGER IF EXISTS trigger_update_main_lab_report ON lab_report_versions;
DROP TRIGGER IF EXISTS trigger_update_unified_lab_report_from_version ON lab_report_versions;
DROP FUNCTION IF EXISTS create_initial_lab_report_version();
DROP FUNCTION IF EXISTS update_main_lab_report(UUID, INTEGER);
DROP FUNCTION IF EXISTS update_unified_lab_report_from_version();
DROP FUNCTION IF EXISTS get_next_lab_report_version(UUID);

-- Create function to update unified_lab_reports from lab_report_versions
CREATE OR REPLACE FUNCTION update_unified_lab_report_from_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the unified_lab_reports table with data from the latest version
  UPDATE unified_lab_reports 
  SET 
    assignment_id = NEW.assignment_id,
    borelog_id = NEW.borelog_id,
    sample_id = NEW.sample_id,
    project_name = NEW.project_name,
    borehole_no = NEW.borehole_no,
    client = NEW.client,
    test_date = NEW.test_date,
    tested_by = NEW.tested_by,
    checked_by = NEW.checked_by,
    approved_by = NEW.approved_by,
    test_types = NEW.test_types,
    soil_test_data = NEW.soil_test_data,
    rock_test_data = NEW.rock_test_data,
    status = NEW.status,
    remarks = NEW.remarks,
    submitted_at = NEW.submitted_at,
    approved_at = NEW.approved_at,
    rejected_at = NEW.rejected_at,
    rejection_reason = NEW.rejection_reason,
    updated_at = NOW()
  WHERE report_id = NEW.report_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update unified_lab_reports when a version is inserted or updated
CREATE TRIGGER trigger_update_unified_lab_report_from_version
  AFTER INSERT OR UPDATE ON lab_report_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_unified_lab_report_from_version();

-- Create function to get the next version number
CREATE OR REPLACE FUNCTION get_next_lab_report_version(report_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_no), 0) + 1
  INTO next_version
  FROM lab_report_versions
  WHERE report_id = report_id_param;
  
  RETURN next_version;
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint to prevent duplicate versions
ALTER TABLE lab_report_versions 
ADD CONSTRAINT unique_report_version UNIQUE (report_id, version_no);

COMMIT;
