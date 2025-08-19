-- Migration: Add missing fields to borelog_details table
-- Date: 2025-08-19

BEGIN;

-- Add missing fields to borelog_details table
ALTER TABLE borelog_details 
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS chainage_km NUMERIC,
ADD COLUMN IF NOT EXISTS job_code TEXT;

COMMIT;


