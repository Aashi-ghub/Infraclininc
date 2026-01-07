-- Migration: Add version_no column to borelog_details table
-- Date: 2024-12-08

-- Add version_no column to borelog_details table
ALTER TABLE borelog_details ADD COLUMN IF NOT EXISTS version_no INTEGER DEFAULT 1;

-- Create index for better performance on version queries
CREATE INDEX IF NOT EXISTS idx_borelog_details_version ON borelog_details (borelog_id, version_no);

-- Update existing records to have version_no = 1 if they don't have it
UPDATE borelog_details SET version_no = 1 WHERE version_no IS NULL;

-- Make version_no NOT NULL after setting default values
ALTER TABLE borelog_details ALTER COLUMN version_no SET NOT NULL;

-- Add unique constraint to ensure no duplicate versions for the same borelog
ALTER TABLE borelog_details ADD CONSTRAINT unique_borelog_version 
  UNIQUE (borelog_id, version_no);


