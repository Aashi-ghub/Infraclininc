-- Migration: Add created_by_user_id column to unified_lab_reports table
-- Date: 2025-01-27

BEGIN;

-- Add created_by_user_id column to unified_lab_reports if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'unified_lab_reports' AND column_name = 'created_by_user_id') THEN
    ALTER TABLE unified_lab_reports ADD COLUMN created_by_user_id UUID;
    ALTER TABLE unified_lab_reports ADD CONSTRAINT fk_unified_lab_reports_created_by 
      FOREIGN KEY (created_by_user_id) REFERENCES users (user_id) ON DELETE SET NULL;
    
    -- Add comment
    COMMENT ON COLUMN unified_lab_reports.created_by_user_id IS 'User who created this lab report';
  END IF;
END $$;

COMMIT;






