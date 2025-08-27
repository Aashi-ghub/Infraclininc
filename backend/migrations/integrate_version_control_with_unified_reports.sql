-- Migration: Integrate version control with unified lab reports
-- Date: 2025-01-27

BEGIN;

-- Create function to create a new version when unified lab report is created
CREATE OR REPLACE FUNCTION create_initial_lab_report_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version_no INTEGER;
BEGIN
  -- Get the next version number (should be 1 for new reports)
  SELECT get_next_lab_report_version(NEW.report_id) INTO next_version_no;
  
  -- Create the initial version
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
    NEW.assignment_id,
    NEW.borelog_id,
    NEW.sample_id,
    NEW.project_name,
    NEW.borehole_no,
    NEW.client,
    NEW.test_date,
    NEW.tested_by,
    NEW.checked_by,
    NEW.approved_by,
    NEW.test_types,
    NEW.soil_test_data,
    NEW.rock_test_data,
    NEW.status,
    NEW.remarks,
    NEW.created_by_user_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to create initial version when unified lab report is created
DROP TRIGGER IF EXISTS trigger_create_initial_lab_report_version ON unified_lab_reports;
CREATE TRIGGER trigger_create_initial_lab_report_version
  AFTER INSERT ON unified_lab_reports
  FOR EACH ROW
  EXECUTE FUNCTION create_initial_lab_report_version();

-- Create function to create a new version when unified lab report is updated
CREATE OR REPLACE FUNCTION create_lab_report_version_on_update()
RETURNS TRIGGER AS $$
DECLARE
  next_version_no INTEGER;
BEGIN
  -- Only create a new version if there are actual changes
  IF (OLD.soil_test_data IS DISTINCT FROM NEW.soil_test_data OR
      OLD.rock_test_data IS DISTINCT FROM NEW.rock_test_data OR
      OLD.test_types IS DISTINCT FROM NEW.test_types OR
      OLD.status IS DISTINCT FROM NEW.status OR
      OLD.remarks IS DISTINCT FROM NEW.remarks OR
      OLD.rejection_reason IS DISTINCT FROM NEW.rejection_reason) THEN
    
    -- Get the next version number
    SELECT get_next_lab_report_version(NEW.report_id) INTO next_version_no;
    
    -- Create a new version with the updated data
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
      rejection_reason,
      created_by_user_id
    ) VALUES (
      NEW.report_id,
      next_version_no,
      NEW.assignment_id,
      NEW.borelog_id,
      NEW.sample_id,
      NEW.project_name,
      NEW.borehole_no,
      NEW.client,
      NEW.test_date,
      NEW.tested_by,
      NEW.checked_by,
      NEW.approved_by,
      NEW.test_types,
      NEW.soil_test_data,
      NEW.rock_test_data,
      NEW.status,
      NEW.remarks,
      NEW.rejection_reason,
      NEW.created_by_user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to create new version when unified lab report is updated
DROP TRIGGER IF EXISTS trigger_create_lab_report_version_on_update ON unified_lab_reports;
CREATE TRIGGER trigger_create_lab_report_version_on_update
  AFTER UPDATE ON unified_lab_reports
  FOR EACH ROW
  EXECUTE FUNCTION create_lab_report_version_on_update();

-- Add comments to functions
COMMENT ON FUNCTION create_initial_lab_report_version IS 'Creates the initial version when a new unified lab report is created';
COMMENT ON FUNCTION create_lab_report_version_on_update IS 'Creates a new version when a unified lab report is updated with changes';

COMMIT;






