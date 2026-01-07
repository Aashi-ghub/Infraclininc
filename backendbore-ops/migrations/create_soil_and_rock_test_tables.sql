-- Migration: Create separate soil and rock test tables
-- Date: 2025-01-29

BEGIN;

-- Create soil test samples table
CREATE TABLE soil_test_samples (
    sample_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES unified_lab_reports(report_id) ON DELETE CASCADE,
    layer_no INTEGER,
    sample_no VARCHAR(50),
    depth_from DECIMAL(10,2),
    depth_to DECIMAL(10,2),
    
    -- Physical Properties
    natural_moisture_content DECIMAL(8,2),
    bulk_density DECIMAL(8,2),
    dry_density DECIMAL(8,2),
    specific_gravity DECIMAL(8,2),
    void_ratio DECIMAL(8,2),
    porosity DECIMAL(8,2),
    degree_of_saturation DECIMAL(8,2),
    
    -- Atterberg Limits
    liquid_limit DECIMAL(8,2),
    plastic_limit DECIMAL(8,2),
    plasticity_index DECIMAL(8,2),
    shrinkage_limit DECIMAL(8,2),
    
    -- Grain Size Analysis
    gravel_percentage DECIMAL(8,2),
    sand_percentage DECIMAL(8,2),
    silt_percentage DECIMAL(8,2),
    clay_percentage DECIMAL(8,2),
    
    -- Shear Strength
    cohesion DECIMAL(8,2),
    angle_of_internal_friction DECIMAL(8,2),
    unconfined_compressive_strength DECIMAL(8,2),
    
    -- Consolidation
    compression_index DECIMAL(8,2),
    recompression_index DECIMAL(8,2),
    preconsolidation_pressure DECIMAL(8,2),
    
    -- Permeability
    permeability_coefficient DECIMAL(12,6),
    
    -- California Bearing Ratio (CBR)
    cbr_value DECIMAL(8,2),
    
    -- Other Properties
    soil_classification VARCHAR(100),
    soil_description TEXT,
    remarks TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by_user_id UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rock test samples table
CREATE TABLE rock_test_samples (
    sample_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES unified_lab_reports(report_id) ON DELETE CASCADE,
    layer_no INTEGER,
    sample_no VARCHAR(50),
    depth_from DECIMAL(10,2),
    depth_to DECIMAL(10,2),
    
    -- Physical Properties
    natural_moisture_content DECIMAL(8,2),
    bulk_density DECIMAL(8,2),
    dry_density DECIMAL(8,2),
    specific_gravity DECIMAL(8,2),
    porosity DECIMAL(8,2),
    water_absorption DECIMAL(8,2),
    
    -- Strength Properties
    unconfined_compressive_strength DECIMAL(8,2),
    point_load_strength_index DECIMAL(8,2),
    tensile_strength DECIMAL(8,2),
    shear_strength DECIMAL(8,2),
    
    -- Elastic Properties
    youngs_modulus DECIMAL(10,2),
    poissons_ratio DECIMAL(8,4),
    
    -- Durability
    slake_durability_index DECIMAL(8,2),
    soundness_loss DECIMAL(8,2),
    
    -- Abrasion
    los_angeles_abrasion_value DECIMAL(8,2),
    
    -- Other Properties
    rock_classification VARCHAR(100),
    rock_description TEXT,
    rock_quality_designation DECIMAL(8,2),
    remarks TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by_user_id UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_soil_test_samples_report_id ON soil_test_samples(report_id);
CREATE INDEX idx_soil_test_samples_layer_no ON soil_test_samples(layer_no);
CREATE INDEX idx_soil_test_samples_sample_no ON soil_test_samples(sample_no);

CREATE INDEX idx_rock_test_samples_report_id ON rock_test_samples(report_id);
CREATE INDEX idx_rock_test_samples_layer_no ON rock_test_samples(layer_no);
CREATE INDEX idx_rock_test_samples_sample_no ON rock_test_samples(sample_no);

-- Add comments
COMMENT ON TABLE soil_test_samples IS 'Individual soil test samples for each lab report';
COMMENT ON TABLE rock_test_samples IS 'Individual rock test samples for each lab report';

COMMIT;
