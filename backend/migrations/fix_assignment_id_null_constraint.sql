-- Migration: Fix assignment_id NULL constraint for draft reports
-- Date: 2025-01-29

BEGIN;

-- Ensure assignment_id can be null in unified_lab_reports for drafts
ALTER TABLE unified_lab_reports ALTER COLUMN assignment_id DROP NOT NULL;

-- Ensure assignment_id can be null in lab_report_versions for drafts
ALTER TABLE lab_report_versions ALTER COLUMN assignment_id DROP NOT NULL;

-- Add comment to clarify the purpose
COMMENT ON COLUMN unified_lab_reports.assignment_id IS 'Can be null for draft reports that are not yet assigned';
COMMENT ON COLUMN lab_report_versions.assignment_id IS 'Can be null for draft reports that are not yet assigned';

COMMIT;
