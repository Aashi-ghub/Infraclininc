-- Migration: Add file_url column to pending_csv_uploads table for S3 storage
-- Date: 2025-01-27
-- This migration is additive and safe - adds a new nullable column without breaking existing functionality

BEGIN;

-- Add file_url column to store S3 URL
ALTER TABLE pending_csv_uploads 
ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Add comment to document the purpose
COMMENT ON COLUMN pending_csv_uploads.file_url IS 'S3 URL where the original CSV/Excel file is stored';

COMMIT;








