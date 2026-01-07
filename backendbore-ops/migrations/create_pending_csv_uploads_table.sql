-- Migration: Create pending CSV uploads table for approval workflow
-- Date: 2025-01-27

BEGIN;

-- Create pending_csv_uploads table to store CSV uploads awaiting approval
CREATE TABLE IF NOT EXISTS pending_csv_uploads (
  upload_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  structure_id UUID NOT NULL,
  substructure_id UUID NOT NULL,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- CSV metadata
  file_name TEXT,
  file_type TEXT CHECK (file_type IN ('csv', 'excel')),
  total_records INTEGER NOT NULL,
  
  -- Parsed data (stored as JSONB for flexibility)
  borelog_header_data JSONB NOT NULL,
  stratum_rows_data JSONB NOT NULL,
  
  -- Approval workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'returned_for_revision')),
  submitted_for_approval_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejected_by UUID,
  rejected_at TIMESTAMPTZ,
  returned_by UUID,
  returned_at TIMESTAMPTZ,
  
  -- Comments and feedback
  approval_comments TEXT,
  rejection_reason TEXT,
  revision_notes TEXT,
  
  -- Processing
  processed_at TIMESTAMPTZ,
  created_borelog_id UUID,
  error_message TEXT,
  
  -- Constraints
  FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  FOREIGN KEY (structure_id) REFERENCES structure (structure_id) ON DELETE CASCADE,
  FOREIGN KEY (substructure_id) REFERENCES sub_structures (substructure_id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users (user_id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users (user_id) ON DELETE SET NULL,
  FOREIGN KEY (rejected_by) REFERENCES users (user_id) ON DELETE SET NULL,
  FOREIGN KEY (returned_by) REFERENCES users (user_id) ON DELETE SET NULL,
  FOREIGN KEY (created_borelog_id) REFERENCES boreloge (borelog_id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pending_csv_uploads_project ON pending_csv_uploads (project_id);
CREATE INDEX IF NOT EXISTS idx_pending_csv_uploads_status ON pending_csv_uploads (status);
CREATE INDEX IF NOT EXISTS idx_pending_csv_uploads_uploaded_by ON pending_csv_uploads (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_pending_csv_uploads_uploaded_at ON pending_csv_uploads (uploaded_at);

-- Add comments
COMMENT ON TABLE pending_csv_uploads IS 'Stores CSV uploads awaiting approval before creating borelogs';
COMMENT ON COLUMN pending_csv_uploads.borelog_header_data IS 'JSON data containing the borelog header information from CSV';
COMMENT ON COLUMN pending_csv_uploads.stratum_rows_data IS 'JSON array containing all stratum rows from CSV';

COMMIT;
