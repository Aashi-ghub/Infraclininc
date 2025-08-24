-- Migration: Clean up duplicate reports and fix data structure
-- Date: 2025-01-27

BEGIN;

-- First, let's identify and remove duplicate unified_lab_reports
-- Keep only the most recent one for each assignment_id
DELETE FROM unified_lab_reports 
WHERE report_id IN (
  SELECT report_id FROM (
    SELECT report_id,
           ROW_NUMBER() OVER (PARTITION BY assignment_id ORDER BY created_at DESC) as rn
    FROM unified_lab_reports
  ) t
  WHERE t.rn > 1
);

-- Remove any orphaned lab_report_versions that don't have a corresponding unified_lab_report
DELETE FROM lab_report_versions 
WHERE report_id NOT IN (SELECT report_id FROM unified_lab_reports);

-- Ensure each assignment has only one report
-- If multiple reports exist for the same assignment, keep the one with the most recent version
DELETE FROM unified_lab_reports 
WHERE report_id IN (
  SELECT ur.report_id FROM unified_lab_reports ur
  WHERE EXISTS (
    SELECT 1 FROM unified_lab_reports ur2 
    WHERE ur2.assignment_id = ur.assignment_id 
    AND ur2.report_id != ur.report_id
    AND ur2.created_at > ur.created_at
  )
);

-- Update the version numbers to be sequential starting from 1 for each report
WITH version_updates AS (
  SELECT 
    report_id,
    version_no,
    ROW_NUMBER() OVER (PARTITION BY report_id ORDER BY created_at) as new_version_no
  FROM lab_report_versions
)
UPDATE lab_report_versions 
SET version_no = vu.new_version_no
FROM version_updates vu
WHERE lab_report_versions.report_id = vu.report_id 
AND lab_report_versions.version_no = vu.version_no;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lab_report_versions_report_id ON lab_report_versions (report_id);
CREATE INDEX IF NOT EXISTS idx_lab_report_versions_version_no ON lab_report_versions (version_no);
CREATE INDEX IF NOT EXISTS idx_unified_lab_reports_assignment_id ON unified_lab_reports (assignment_id);

COMMIT;
