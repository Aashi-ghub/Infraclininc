-- Migration: Add missing fields to borelog_versions table
-- Date: 2025-08-18

BEGIN;

-- Add missing fields to borelog_versions table
ALTER TABLE borelog_versions 
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS chainage_km NUMERIC,
ADD COLUMN IF NOT EXISTS job_code TEXT;

COMMIT;
