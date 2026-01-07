-- Migration: Create borelog_assignments table for tracking site engineer assignments to borelogs
-- Date: 2025-01-27

BEGIN;

-- Create borelog_assignments table
CREATE TABLE IF NOT EXISTS borelog_assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borelog_id UUID,
  structure_id UUID,
  substructure_id UUID,
  assigned_site_engineer UUID NOT NULL,
  assigned_by UUID NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  notes TEXT,
  expected_completion_date DATE,
  completed_at TIMESTAMPTZ,
  
  -- Ensure at least one of borelog_id, structure_id, or substructure_id is provided
  CONSTRAINT check_assignment_target CHECK (
    (borelog_id IS NOT NULL) OR 
    (structure_id IS NOT NULL) OR 
    (substructure_id IS NOT NULL)
  ),
  
  FOREIGN KEY (borelog_id) REFERENCES boreloge(borelog_id) ON DELETE CASCADE,
  FOREIGN KEY (structure_id) REFERENCES structure(structure_id) ON DELETE CASCADE,
  FOREIGN KEY (substructure_id) REFERENCES sub_structures(substructure_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_site_engineer) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_borelog_assignments_borelog_id ON borelog_assignments (borelog_id);
CREATE INDEX IF NOT EXISTS idx_borelog_assignments_structure_id ON borelog_assignments (structure_id);
CREATE INDEX IF NOT EXISTS idx_borelog_assignments_substructure_id ON borelog_assignments (substructure_id);
CREATE INDEX IF NOT EXISTS idx_borelog_assignments_site_engineer ON borelog_assignments (assigned_site_engineer);
CREATE INDEX IF NOT EXISTS idx_borelog_assignments_status ON borelog_assignments (status);
CREATE INDEX IF NOT EXISTS idx_borelog_assignments_assigned_at ON borelog_assignments (assigned_at);

-- Add unique constraint to prevent duplicate active assignments for the same target
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_borelog_assignment 
ON borelog_assignments (borelog_id, assigned_site_engineer) 
WHERE borelog_id IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_structure_assignment 
ON borelog_assignments (structure_id, assigned_site_engineer) 
WHERE structure_id IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_substructure_assignment 
ON borelog_assignments (substructure_id, assigned_site_engineer) 
WHERE substructure_id IS NOT NULL AND status = 'active';

COMMIT;
