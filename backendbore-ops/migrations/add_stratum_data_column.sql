-- Add stratum_data column to borelog_details table
ALTER TABLE borelog_details 
ADD COLUMN stratum_data TEXT;

-- Add stratum_data column to borelog_versions table
ALTER TABLE borelog_versions 
ADD COLUMN stratum_data TEXT;

-- Add comments to document the purpose
COMMENT ON COLUMN borelog_details.stratum_data IS 'JSON string containing stratum data array';
COMMENT ON COLUMN borelog_versions.stratum_data IS 'JSON string containing stratum data array';

