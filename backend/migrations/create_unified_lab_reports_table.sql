-- Migration: Create unified_lab_reports table for storing combined soil and rock test data
-- Date: 2025-01-27

BEGIN;

-- Create unified_lab_reports table
CREATE TABLE IF NOT EXISTS unified_lab_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  remarks TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (assignment_id) REFERENCES lab_test_assignments (assignment_id) ON DELETE CASCADE,
  FOREIGN KEY (borelog_id) REFERENCES boreloge (borelog_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_unified_lab_reports_assignment_id ON unified_lab_reports (assignment_id);
CREATE INDEX IF NOT EXISTS idx_unified_lab_reports_borelog_id ON unified_lab_reports (borelog_id);
CREATE INDEX IF NOT EXISTS idx_unified_lab_reports_sample_id ON unified_lab_reports (sample_id);
CREATE INDEX IF NOT EXISTS idx_unified_lab_reports_status ON unified_lab_reports (status);
CREATE INDEX IF NOT EXISTS idx_unified_lab_reports_tested_by ON unified_lab_reports (tested_by);
CREATE INDEX IF NOT EXISTS idx_unified_lab_reports_created_at ON unified_lab_reports (created_at);
CREATE INDEX IF NOT EXISTS idx_unified_lab_reports_project_name ON unified_lab_reports (project_name);
CREATE INDEX IF NOT EXISTS idx_unified_lab_reports_borehole_no ON unified_lab_reports (borehole_no);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_unified_lab_reports_borelog_status ON unified_lab_reports (borelog_id, status);
CREATE INDEX IF NOT EXISTS idx_unified_lab_reports_assignment_status ON unified_lab_reports (assignment_id, status);

-- Add comments to table and columns
COMMENT ON TABLE unified_lab_reports IS 'Stores unified lab reports containing both soil and rock test data';
COMMENT ON COLUMN unified_lab_reports.report_id IS 'Primary key for the unified lab report';
COMMENT ON COLUMN unified_lab_reports.assignment_id IS 'Reference to lab test assignment';
COMMENT ON COLUMN unified_lab_reports.borelog_id IS 'Reference to the borelog';
COMMENT ON COLUMN unified_lab_reports.sample_id IS 'Sample identifier';
COMMENT ON COLUMN unified_lab_reports.project_name IS 'Name of the project';
COMMENT ON COLUMN unified_lab_reports.borehole_no IS 'Borehole number';
COMMENT ON COLUMN unified_lab_reports.client IS 'Client name';
COMMENT ON COLUMN unified_lab_reports.test_date IS 'Date when tests were performed';
COMMENT ON COLUMN unified_lab_reports.tested_by IS 'Name of the lab engineer who performed the tests';
COMMENT ON COLUMN unified_lab_reports.checked_by IS 'Name of the person who checked the report';
COMMENT ON COLUMN unified_lab_reports.approved_by IS 'Name of the person who approved the report';
COMMENT ON COLUMN unified_lab_reports.test_types IS 'Array of test types included in this report (e.g., ["Soil", "Rock"])';
COMMENT ON COLUMN unified_lab_reports.soil_test_data IS 'JSON array containing all soil test data';
COMMENT ON COLUMN unified_lab_reports.rock_test_data IS 'JSON array containing all rock test data';
COMMENT ON COLUMN unified_lab_reports.status IS 'Current status of the report';
COMMENT ON COLUMN unified_lab_reports.remarks IS 'Additional notes or comments';
COMMENT ON COLUMN unified_lab_reports.submitted_at IS 'Timestamp when report was submitted';
COMMENT ON COLUMN unified_lab_reports.approved_at IS 'Timestamp when report was approved';
COMMENT ON COLUMN unified_lab_reports.rejected_at IS 'Timestamp when report was rejected';
COMMENT ON COLUMN unified_lab_reports.rejection_reason IS 'Reason for rejection if applicable';

-- Create a view for easier querying of unified reports with assignment details
CREATE OR REPLACE VIEW unified_lab_reports_view AS
SELECT 
  ulr.*,
  lta.assigned_by,
  lta.assigned_to,
  lta.due_date,
  lta.priority,
  lta.notes as assignment_notes,
  p.name as borelog_project_name,
  bd.number as borelog_borehole_number
FROM unified_lab_reports ulr
LEFT JOIN lab_test_assignments lta ON ulr.assignment_id = lta.assignment_id
LEFT JOIN boreloge b ON ulr.borelog_id = b.borelog_id
LEFT JOIN projects p ON b.project_id = p.project_id
LEFT JOIN borelog_details bd ON b.borelog_id = bd.borelog_id;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_unified_lab_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_unified_lab_reports_updated_at
  BEFORE UPDATE ON unified_lab_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_unified_lab_reports_updated_at();

-- Create a function to validate test data
CREATE OR REPLACE FUNCTION validate_unified_lab_report_data()
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
CREATE TRIGGER trigger_validate_unified_lab_report_data
  BEFORE INSERT OR UPDATE ON unified_lab_reports
  FOR EACH ROW
  EXECUTE FUNCTION validate_unified_lab_report_data();

COMMIT;
