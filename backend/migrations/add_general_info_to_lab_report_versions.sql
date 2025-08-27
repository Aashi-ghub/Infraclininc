-- Migration: Add general info fields to lab_report_versions
-- Date: 2025-08-27

BEGIN;

ALTER TABLE lab_report_versions
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS section_name TEXT,
  ADD COLUMN IF NOT EXISTS chainage_km NUMERIC,
  ADD COLUMN IF NOT EXISTS coordinates_e NUMERIC,
  ADD COLUMN IF NOT EXISTS coordinates_n NUMERIC;

COMMIT;


