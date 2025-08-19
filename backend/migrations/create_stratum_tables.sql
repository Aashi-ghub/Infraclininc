-- Migration: Create stratum tables for proper relational storage
-- Date: 2025-08-18

BEGIN;

-- Create stratum_layers table to store multiple layers per borelog version
CREATE TABLE IF NOT EXISTS stratum_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    borelog_id UUID NOT NULL,
    version_no INTEGER NOT NULL,
    layer_order INTEGER NOT NULL, -- Order of layers (1, 2, 3, etc.)
    
    -- Basic stratum information
    description TEXT,
    depth_from_m DECIMAL(10,2),
    depth_to_m DECIMAL(10,2),
    thickness_m DECIMAL(10,2),
    
    -- Water and remarks (shared across all sample points in this layer)
    return_water_colour TEXT,
    water_loss TEXT,
    borehole_diameter DECIMAL(10,2),
    remarks TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by_user_id UUID,
    
    -- Constraints
    FOREIGN KEY (borelog_id) REFERENCES boreloge(borelog_id) ON DELETE CASCADE,
    UNIQUE(borelog_id, version_no, layer_order)
);

-- Create stratum_sample_points table for subdivisions within each layer
CREATE TABLE IF NOT EXISTS stratum_sample_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stratum_layer_id UUID NOT NULL,
    sample_order INTEGER NOT NULL, -- Order within the layer (1, 2, 3, etc.)
    
    -- Sample type and depth information
    sample_type TEXT, -- e.g., "S/D-1", "U-1", "VS-1"
    depth_mode TEXT CHECK (depth_mode IN ('single', 'range')), -- 'single' or 'range'
    depth_single_m DECIMAL(10,2), -- For single depth mode
    depth_from_m DECIMAL(10,2), -- For range mode
    depth_to_m DECIMAL(10,2), -- For range mode
    run_length_m DECIMAL(10,2), -- Calculated: depth_to - depth_from
    
    -- SPT values
    spt_15cm_1 INTEGER,
    spt_15cm_2 INTEGER,
    spt_15cm_3 INTEGER,
    n_value INTEGER, -- Calculated: sum of SPT values
    
    -- Core data
    total_core_length_cm DECIMAL(10,2),
    tcr_percent DECIMAL(5,2), -- Calculated: (total_core_length / run_length) * 100
    rqd_length_cm DECIMAL(10,2),
    rqd_percent DECIMAL(5,2), -- Calculated: (rqd_length / run_length) * 100
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by_user_id UUID,
    
    -- Constraints
    FOREIGN KEY (stratum_layer_id) REFERENCES stratum_layers(id) ON DELETE CASCADE,
    UNIQUE(stratum_layer_id, sample_order)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stratum_layers_borelog_version ON stratum_layers(borelog_id, version_no);
CREATE INDEX IF NOT EXISTS idx_stratum_sample_points_layer ON stratum_sample_points(stratum_layer_id);

-- Add comments
COMMENT ON TABLE stratum_layers IS 'Stores multiple stratum layers for each borelog version';
COMMENT ON TABLE stratum_sample_points IS 'Stores sample points (subdivisions) within each stratum layer';

COMMIT;

