-- Migration: Add created_by_user_id column to borelog_details table
-- Date: 2024-12-08

-- Add created_by_user_id column to borelog_details table
ALTER TABLE borelog_details ADD COLUMN IF NOT EXISTS created_by_user_id UUID;

-- Add foreign key for created_by_user_id (using DO block to handle IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_borelog_details_created_by' 
    AND table_name = 'borelog_details'
  ) THEN
    ALTER TABLE borelog_details ADD CONSTRAINT fk_borelog_details_created_by 
      FOREIGN KEY (created_by_user_id) REFERENCES users (user_id) ON DELETE SET NULL;
  END IF;
END$$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_borelog_details_created_by ON borelog_details (created_by_user_id);


