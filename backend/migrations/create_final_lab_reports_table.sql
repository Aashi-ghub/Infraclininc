-- Migration: Create final_lab_reports table for customer-accessible approved reports
-- Date: 2025-01-27

BEGIN;

-- Create final_lab_reports table for customer-accessible approved reports
CREATE TABLE IF NOT EXISTS final_lab_reports (
  final_report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_report_id UUID NOT NULL,
  assignment_id UUID,
  borelog_id UUID NOT NULL,
  sample_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  borehole_no TEXT NOT NULL,
  client TEXT,
  test_date TIMESTAMPTZ NOT NULL,
  tested_by TEXT NOT NULL,
  checked_by TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  test_types JSONB NOT NULL,
  soil_test_data JSONB NOT NULL,
  rock_test_data JSONB NOT NULL,
  final_version_no INTEGER NOT NULL,
  approval_date TIMESTAMPTZ NOT NULL,
  approved_by_user_id UUID NOT NULL,
  customer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (original_report_id) REFERENCES unified_lab_reports (report_id) ON DELETE CASCADE,
  FOREIGN KEY (assignment_id) REFERENCES lab_test_assignments (assignment_id) ON DELETE SET NULL,
  FOREIGN KEY (borelog_id) REFERENCES boreloge (borelog_id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by_user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  UNIQUE (original_report_id) -- Only one final report per original report
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_final_lab_reports_original_report_id ON final_lab_reports (original_report_id);
CREATE INDEX IF NOT EXISTS idx_final_lab_reports_assignment_id ON final_lab_reports (assignment_id);
CREATE INDEX IF NOT EXISTS idx_final_lab_reports_borelog_id ON final_lab_reports (borelog_id);
CREATE INDEX IF NOT EXISTS idx_final_lab_reports_sample_id ON final_lab_reports (sample_id);
CREATE INDEX IF NOT EXISTS idx_final_lab_reports_project_name ON final_lab_reports (project_name);
CREATE INDEX IF NOT EXISTS idx_final_lab_reports_approval_date ON final_lab_reports (approval_date);
CREATE INDEX IF NOT EXISTS idx_final_lab_reports_approved_by ON final_lab_reports (approved_by_user_id);

-- Create a view for easier querying of final reports with assignment details
CREATE OR REPLACE VIEW final_lab_reports_view AS
SELECT 
  flr.*,
  lta.assigned_by,
  lta.assigned_to,
  lta.due_date,
  lta.priority,
  lta.notes as assignment_notes,
  p.name as borelog_project_name,
  bd.number as borelog_borehole_number,
  u.name as approved_by_name,
  u.email as approved_by_email
FROM final_lab_reports flr
LEFT JOIN lab_test_assignments lta ON flr.assignment_id = lta.assignment_id
LEFT JOIN boreloge b ON flr.borelog_id = b.borelog_id
LEFT JOIN projects p ON b.project_id = p.project_id
LEFT JOIN borelog_details bd ON b.borelog_id = bd.borelog_id
LEFT JOIN users u ON flr.approved_by_user_id = u.user_id;

-- Add comments
COMMENT ON TABLE final_lab_reports IS 'Stores final approved lab reports accessible to customers';
COMMENT ON COLUMN final_lab_reports.final_report_id IS 'Primary key for the final lab report';
COMMENT ON COLUMN final_lab_reports.original_report_id IS 'Reference to the original unified lab report';
COMMENT ON COLUMN final_lab_reports.final_version_no IS 'Version number of the approved report';
COMMENT ON COLUMN final_lab_reports.approval_date IS 'Date when the report was approved';
COMMENT ON COLUMN final_lab_reports.approved_by_user_id IS 'User who approved the report';

COMMIT;
