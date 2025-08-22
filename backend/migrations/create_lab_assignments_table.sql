-- Migration: Create lab_assignments table for tracking lab test assignments
-- Date: 2025-01-27

BEGIN;

-- Create lab_assignments table
CREATE TABLE IF NOT EXISTS lab_assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borelog_id UUID NOT NULL,
  sample_id TEXT NOT NULL,
  test_type TEXT NOT NULL,
  assigned_lab_engineer UUID NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  expected_completion_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'reviewed')),
  assigned_by UUID NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  test_results JSONB,
  remarks TEXT,
  
  FOREIGN KEY (borelog_id) REFERENCES boreloge(borelog_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_lab_engineer) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lab_assignments_borelog_id ON lab_assignments (borelog_id);
CREATE INDEX IF NOT EXISTS idx_lab_assignments_assigned_engineer ON lab_assignments (assigned_lab_engineer);
CREATE INDEX IF NOT EXISTS idx_lab_assignments_status ON lab_assignments (status);
CREATE INDEX IF NOT EXISTS idx_lab_assignments_assigned_at ON lab_assignments (assigned_at);

-- Add columns to borelog_versions table for workflow tracking
ALTER TABLE borelog_versions 
ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS submission_comments TEXT,
ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS returned_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS review_comments TEXT;

-- Update the status check constraint to include new statuses
ALTER TABLE borelog_versions 
DROP CONSTRAINT IF EXISTS borelog_versions_status_check;

ALTER TABLE borelog_versions 
ADD CONSTRAINT borelog_versions_status_check 
CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'returned_for_revision'));

COMMIT;



-- Add workflow status tables for comprehensive borelog workflow

-- Create enum for borelog workflow status
CREATE TYPE borelog_workflow_status AS ENUM (
  'draft',
  'submitted_for_review',
  'under_review',
  'approved',
  'rejected',
  'frozen_for_lab',
  'lab_testing',
  'lab_completed',
  'lab_approved',
  'final_approved'
);

-- Create enum for lab test status
CREATE TYPE lab_test_status AS ENUM (
  'pending',
  'assigned',
  'in_progress',
  'completed',
  'reviewed',
  'approved',
  'rejected'
);

-- Create enum for review comments type
CREATE TYPE review_comment_type AS ENUM (
  'correction_required',
  'additional_info_needed',
  'approval_comment',
  'rejection_reason'
);

-- Add workflow status to borelog_versions table
ALTER TABLE borelog_versions ADD COLUMN workflow_status borelog_workflow_status DEFAULT 'draft';
ALTER TABLE borelog_versions ADD COLUMN submitted_at TIMESTAMPTZ;
ALTER TABLE borelog_versions ADD COLUMN submitted_by UUID;
ALTER TABLE borelog_versions ADD COLUMN reviewed_at TIMESTAMPTZ;
ALTER TABLE borelog_versions ADD COLUMN reviewed_by UUID;
ALTER TABLE borelog_versions ADD COLUMN frozen_at TIMESTAMPTZ;
ALTER TABLE borelog_versions ADD COLUMN frozen_by UUID;

-- Create review comments table
CREATE TABLE borelog_review_comments (
  comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borelog_id UUID NOT NULL,
  version_no INTEGER NOT NULL,
  comment_type review_comment_type NOT NULL,
  comment_text TEXT NOT NULL,
  commented_by UUID NOT NULL,
  commented_at TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  
  FOREIGN KEY (borelog_id) REFERENCES boreloge (borelog_id) ON DELETE CASCADE,
  FOREIGN KEY (commented_by) REFERENCES users (user_id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by) REFERENCES users (user_id) ON DELETE SET NULL,
  
  UNIQUE (borelog_id, version_no, comment_id)
);

-- Create lab test assignments table
CREATE TABLE lab_test_assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borelog_id UUID NOT NULL,
  version_no INTEGER NOT NULL,
  sample_ids TEXT[] NOT NULL, -- Array of sample IDs
  assigned_by UUID NOT NULL,
  assigned_to UUID NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  priority TEXT DEFAULT 'normal',
  notes TEXT,
  
  FOREIGN KEY (borelog_id) REFERENCES boreloge (borelog_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users (user_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users (user_id) ON DELETE CASCADE
);

-- Create lab test results table
CREATE TABLE lab_test_results (
  test_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL,
  sample_id TEXT NOT NULL,
  test_type TEXT NOT NULL,
  test_date TIMESTAMPTZ NOT NULL,
  results JSONB NOT NULL,
  technician UUID NOT NULL,
  status lab_test_status DEFAULT 'pending',
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (assignment_id) REFERENCES lab_test_assignments (assignment_id) ON DELETE CASCADE,
  FOREIGN KEY (technician) REFERENCES users (user_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_borelog_versions_workflow_status ON borelog_versions (workflow_status);
CREATE INDEX idx_borelog_versions_submitted_by ON borelog_versions (submitted_by);
CREATE INDEX idx_borelog_versions_reviewed_by ON borelog_versions (reviewed_by);
CREATE INDEX idx_borelog_review_comments_borelog ON borelog_review_comments (borelog_id, version_no);
CREATE INDEX idx_borelog_review_comments_type ON borelog_review_comments (comment_type);
CREATE INDEX idx_lab_test_assignments_borelog ON lab_test_assignments (borelog_id, version_no);
CREATE INDEX idx_lab_test_assignments_assigned_to ON lab_test_assignments (assigned_to);
CREATE INDEX idx_lab_test_results_assignment ON lab_test_results (assignment_id);
CREATE INDEX idx_lab_test_results_status ON lab_test_results (status);

-- Add comments to tables
COMMENT ON TABLE borelog_review_comments IS 'Stores review comments and feedback for borelog versions';
COMMENT ON TABLE lab_test_assignments IS 'Tracks lab test assignments from project managers to lab engineers';
COMMENT ON TABLE lab_test_results IS 'Stores actual lab test results and data';

