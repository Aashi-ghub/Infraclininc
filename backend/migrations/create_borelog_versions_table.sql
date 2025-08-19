-- Migration: Create borelog_versions table to store non-final versions separately
-- Date: 2025-08-18

BEGIN;

CREATE TABLE IF NOT EXISTS borelog_versions (
  borelog_id UUID NOT NULL REFERENCES boreloge(borelog_id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,

  -- Fields mirroring borelog_details
  number TEXT,
  msl TEXT,
  boring_method TEXT,
  hole_diameter DOUBLE PRECISION,
  commencement_date TIMESTAMP,
  completion_date TIMESTAMP,
  standing_water_level DOUBLE PRECISION,
  termination_depth DOUBLE PRECISION,
  coordinate GEOGRAPHY(POINT),

  permeability_test_count TEXT,
  spt_vs_test_count TEXT,
  undisturbed_sample_count TEXT,
  disturbed_sample_count TEXT,
  water_sample_count TEXT,

  stratum_description TEXT,
  stratum_depth_from NUMERIC,
  stratum_depth_to NUMERIC,
  stratum_thickness_m DOUBLE PRECISION,

  sample_event_type TEXT,
  sample_event_depth_m DOUBLE PRECISION,
  run_length_m DOUBLE PRECISION,
  spt_blows_per_15cm DOUBLE PRECISION,
  n_value_is_2131 TEXT,
  total_core_length_cm DOUBLE PRECISION,
  tcr_percent DOUBLE PRECISION,
  rqd_length_cm DOUBLE PRECISION,
  rqd_percent DOUBLE PRECISION,

  return_water_colour TEXT,
  water_loss TEXT,
  borehole_diameter DOUBLE PRECISION,
  remarks TEXT,

  created_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted','approved','rejected')),
  approved_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (borelog_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_borelog_versions_borelog_id ON borelog_versions (borelog_id);
CREATE INDEX IF NOT EXISTS idx_borelog_versions_status ON borelog_versions (status);

COMMIT;


