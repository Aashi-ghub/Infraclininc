-- Migration: Create lab report version control tables and functions
-- Date: 2025-01-27

BEGIN;

-- Create lab_report_versions table
CREATE TABLE IF NOT EXISTS lab_report_versions (
  version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL,
  version_no INTEGER NOT NULL,
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
  soil_test_data JSONB DEFAULT '[]',
  rock_test_data JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'returned_for_revision')),
  remarks TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  rejection_reason TEXT,
  review_comments TEXT,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (report_id) REFERENCES unified_lab_reports (report_id) ON DELETE CASCADE,
  FOREIGN KEY (assignment_id) REFERENCES lab_test_assignments (assignment_id) ON DELETE SET NULL,
  FOREIGN KEY (borelog_id) REFERENCES boreloge (borelog_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  UNIQUE (report_id, version_no)
);

-- Create lab_report_comments table for review comments
CREATE TABLE IF NOT EXISTS lab_report_comments (
  comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL,
  version_no INTEGER NOT NULL,
  comment_type TEXT NOT NULL CHECK (comment_type IN ('submission', 'review', 'rejection', 'return_for_revision')),
  comment_text TEXT NOT NULL,
  commented_by_user_id UUID NOT NULL,
  commented_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (report_id) REFERENCES unified_lab_reports (report_id) ON DELETE CASCADE,
  FOREIGN KEY (commented_by_user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lab_report_versions_report_id ON lab_report_versions (report_id);
CREATE INDEX IF NOT EXISTS idx_lab_report_versions_version_no ON lab_report_versions (version_no);
CREATE INDEX IF NOT EXISTS idx_lab_report_versions_status ON lab_report_versions (status);
CREATE INDEX IF NOT EXISTS idx_lab_report_versions_created_by ON lab_report_versions (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_lab_report_comments_report_version ON lab_report_comments (report_id, version_no);

-- Create function to get next version number
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

-- Create function to update main report with latest version
CREATE OR REPLACE FUNCTION update_main_lab_report(report_id_param UUID, version_no_param INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE unified_lab_reports
  SET 
    version_no = version_no_param,
    updated_at = NOW()
  WHERE report_id = report_id_param;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update main report when new version is created
CREATE OR REPLACE FUNCTION trigger_update_main_lab_report()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_main_lab_report(NEW.report_id, NEW.version_no);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_main_lab_report
  AFTER INSERT ON lab_report_versions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_main_lab_report();

-- Add version_no column to unified_lab_reports if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'unified_lab_reports' AND column_name = 'version_no') THEN
    ALTER TABLE unified_lab_reports ADD COLUMN version_no INTEGER DEFAULT 1;
  END IF;
END $$;

-- Add created_by_user_id column to unified_lab_reports if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'unified_lab_reports' AND column_name = 'created_by_user_id') THEN
    ALTER TABLE unified_lab_reports ADD COLUMN created_by_user_id UUID;
    ALTER TABLE unified_lab_reports ADD CONSTRAINT fk_unified_lab_reports_created_by 
      FOREIGN KEY (created_by_user_id) REFERENCES users (user_id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add comments to tables
COMMENT ON TABLE lab_report_versions IS 'Stores version history of lab reports';
COMMENT ON TABLE lab_report_comments IS 'Stores review comments and feedback for lab report versions';
COMMENT ON FUNCTION get_next_lab_report_version IS 'Gets the next version number for a lab report';
COMMENT ON FUNCTION update_main_lab_report IS 'Updates the main lab report with the latest version number';

COMMIT;
