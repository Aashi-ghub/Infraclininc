-- Migration: Ensure only one borelog per substructure
-- Date: 2025-08-18

BEGIN;

-- Create a unique constraint so multiple drafts don't create multiple borelogs
ALTER TABLE boreloge
ADD CONSTRAINT uq_boreloge_substructure UNIQUE (substructure_id);

COMMIT;


