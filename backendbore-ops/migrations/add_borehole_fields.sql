-- Migration: Add missing fields to borehole table
-- Date: 2024-12-08

-- Add missing fields to borehole table
ALTER TABLE borehole ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE borehole ADD COLUMN IF NOT EXISTS coordinates JSONB;
ALTER TABLE borehole ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE borehole ADD COLUMN IF NOT EXISTS created_by_user_id UUID;

-- Add status constraint (using DO block to handle IF NOT EXISTS)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_borehole_status' 
    AND table_name = 'borehole'
  ) THEN
    ALTER TABLE borehole ADD CONSTRAINT check_borehole_status 
      CHECK (status IN ('active', 'completed', 'abandoned'));
  END IF;
END$$;

-- Add foreign key for created_by_user_id (using DO block to handle IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_borehole_created_by' 
    AND table_name = 'borehole'
  ) THEN
    ALTER TABLE borehole ADD CONSTRAINT fk_borehole_created_by 
      FOREIGN KEY (created_by_user_id) REFERENCES users (user_id) ON DELETE SET NULL;
  END IF;
END$$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_borehole_project_id ON borehole (project_id);
CREATE INDEX IF NOT EXISTS idx_borehole_structure_id ON borehole (structure_id);
CREATE INDEX IF NOT EXISTS idx_borehole_status ON borehole (status);
CREATE INDEX IF NOT EXISTS idx_borehole_created_by ON borehole (created_by_user_id);
