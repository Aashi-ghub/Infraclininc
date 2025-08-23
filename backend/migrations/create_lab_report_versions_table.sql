-- Migration: Create lab_report_versions table for version control of lab reports
-- Date: 2025-01-27

BEGIN;

-- Create lab_report_versions table for storing multiple versions of lab reports
CREATE TABLE IF NOT EXISTS lab_report_versions (
  report_id UUID NOT NULL REFERENCES unified_lab_reports (report_id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,

  -- Fields mirroring unified_lab_reports
  assignment_id UUID NOT NULL,
  borelog_id UUID NOT NULL,
  sample_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  borehole_no TEXT NOT NULL,
  client TEXT,
  test_date TIMESTAMPTZ NOT NULL,
  tested_by TEXT NOT NULL,
  checked_by TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  test_types JSONB NOT NULL, -- Array of test types: ['Soil', 'Rock']
  soil_test_data JSONB DEFAULT '[]', -- Array of soil test data
  rock_test_data JSONB DEFAULT '[]', -- Array of rock test data
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'returned_for_revision')),
  remarks TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  returned_at TIMESTAMPTZ,
  returned_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  review_comments TEXT,
  created_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (report_id, version_no)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lab_report_versions_report_id ON lab_report_versions (report_id);
CREATE INDEX IF NOT EXISTS idx_lab_report_versions_status ON lab_report_versions (status);
CREATE INDEX IF NOT EXISTS idx_lab_report_versions_assignment_id ON lab_report_versions (assignment_id);
CREATE INDEX IF NOT EXISTS idx_lab_report_versions_borelog_id ON lab_report_versions (borelog_id);
CREATE INDEX IF NOT EXISTS idx_lab_report_versions_created_by ON lab_report_versions (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_lab_report_versions_created_at ON lab_report_versions (created_at);

-- Create lab report review comments table
CREATE TABLE IF NOT EXISTS lab_report_review_comments (
  comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL,
  version_no INTEGER NOT NULL,
  comment_type TEXT NOT NULL CHECK (comment_type IN ('correction_required', 'additional_info_needed', 'approval_comment', 'rejection_reason')),
  comment_text TEXT NOT NULL,
  commented_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  commented_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (report_id, version_no) REFERENCES lab_report_versions (report_id, version_no) ON DELETE CASCADE
);

-- Create indexes for review comments
CREATE INDEX IF NOT EXISTS idx_lab_report_review_comments_report_version ON lab_report_review_comments (report_id, version_no);
CREATE INDEX IF NOT EXISTS idx_lab_report_review_comments_type ON lab_report_review_comments (comment_type);
CREATE INDEX IF NOT EXISTS idx_lab_report_review_comments_by ON lab_report_review_comments (commented_by);

-- Add version control columns to unified_lab_reports table
ALTER TABLE unified_lab_reports 
ADD COLUMN IF NOT EXISTS current_version_no INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS latest_approved_version_no INTEGER,
ADD COLUMN IF NOT EXISTS workflow_status TEXT DEFAULT 'draft' CHECK (workflow_status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'returned_for_revision'));

-- Create a view for easier querying of lab report versions with assignment details
CREATE OR REPLACE VIEW lab_report_versions_view AS
SELECT 
  lrv.*,
  lta.assigned_by,
  lta.assigned_to,
  lta.due_date,
  lta.priority,
  lta.notes as assignment_notes,
  p.name as borelog_project_name,
  bd.number as borelog_borehole_number,
  u1.name as created_by_name,
  u2.name as returned_by_name
FROM lab_report_versions lrv
LEFT JOIN lab_test_assignments lta ON lrv.assignment_id = lta.assignment_id
LEFT JOIN boreloge b ON lrv.borelog_id = b.borelog_id
LEFT JOIN projects p ON b.project_id = p.project_id
LEFT JOIN borelog_details bd ON b.borelog_id = bd.borelog_id
LEFT JOIN users u1 ON lrv.created_by_user_id = u1.user_id
LEFT JOIN users u2 ON lrv.returned_by = u2.user_id;

-- Create a function to update the workflow status
CREATE OR REPLACE FUNCTION update_lab_report_workflow_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the main table's workflow status based on the latest version
  UPDATE unified_lab_reports 
  SET workflow_status = NEW.status,
      current_version_no = NEW.version_no,
      latest_approved_version_no = CASE 
        WHEN NEW.status = 'approved' THEN NEW.version_no 
        ELSE latest_approved_version_no 
      END
  WHERE report_id = NEW.report_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update workflow status
CREATE TRIGGER trigger_update_lab_report_workflow_status
  AFTER INSERT OR UPDATE ON lab_report_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_lab_report_workflow_status();

-- Create a function to validate lab report version data
CREATE OR REPLACE FUNCTION validate_lab_report_version_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure at least one test type is specified
  IF jsonb_array_length(NEW.test_types) = 0 THEN
    RAISE EXCEPTION 'At least one test type must be specified';
  END IF;
  
  -- Ensure soil test data is provided if Soil is in test_types
  IF NEW.test_types ? 'Soil' AND jsonb_array_length(NEW.soil_test_data) = 0 THEN
    RAISE EXCEPTION 'Soil test data must be provided when Soil is in test_types';
  END IF;
  
  -- Ensure rock test data is provided if Rock is in test_types
  IF NEW.test_types ? 'Rock' AND jsonb_array_length(NEW.rock_test_data) = 0 THEN
    RAISE EXCEPTION 'Rock test data must be provided when Rock is in test_types';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate data before insert/update
CREATE TRIGGER trigger_validate_lab_report_version_data
  BEFORE INSERT OR UPDATE ON lab_report_versions
  FOR EACH ROW
  EXECUTE FUNCTION validate_lab_report_version_data();

-- Create a function to get the next version number for a report
CREATE OR REPLACE FUNCTION get_next_lab_report_version(report_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_no), 0) + 1 INTO next_version
  FROM lab_report_versions 
  WHERE report_id = report_uuid;
  
  RETURN next_version;
END;
$$ LANGUAGE plpgsql;

COMMIT;
