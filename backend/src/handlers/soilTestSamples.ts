import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole } from '../utils/validateInput';
import { logger } from '../utils/logger';
import { createResponse } from '../types/common';
import * as db from '../db';

// Get all soil test samples for a report
export const getSoilTestSamples = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Lab Engineer', 'Approval Engineer'])(event);
    if (authError !== null) {
      return authError;
    }

    const reportId = event.pathParameters?.reportId;
    if (!reportId) {
      return createResponse(400, {
        success: false,
        message: 'Report ID is required'
      });
    }

    const query = `
      SELECT * FROM soil_test_samples 
      WHERE report_id = $1 
      ORDER BY layer_no, sample_no
    `;
    const result = await db.query(query, [reportId]);

    return createResponse(200, {
      success: true,
      message: 'Soil test samples retrieved successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error getting soil test samples:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get a specific soil test sample
export const getSoilTestSample = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Lab Engineer', 'Approval Engineer'])(event);
    if (authError !== null) {
      return authError;
    }

    const sampleId = event.pathParameters?.sampleId;
    if (!sampleId) {
      return createResponse(400, {
        success: false,
        message: 'Sample ID is required'
      });
    }

    const query = 'SELECT * FROM soil_test_samples WHERE sample_id = $1';
    const result = await db.query(query, [sampleId]);

    if (result.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Soil test sample not found'
      });
    }

    return createResponse(200, {
      success: true,
      message: 'Soil test sample retrieved successfully',
      data: result[0]
    });
  } catch (error) {
    logger.error('Error getting soil test sample:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update a soil test sample
export const updateSoilTestSample = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Lab Engineer'])(event);
    if (authError !== null) {
      return authError;
    }

    const sampleId = event.pathParameters?.sampleId;
    if (!sampleId) {
      return createResponse(400, {
        success: false,
        message: 'Sample ID is required'
      });
    }

    const body = JSON.parse(event.body || '{}');
    const {
      layer_no, sample_no, depth_from, depth_to,
      natural_moisture_content, bulk_density, dry_density, specific_gravity,
      void_ratio, porosity, degree_of_saturation,
      liquid_limit, plastic_limit, plasticity_index, shrinkage_limit,
      gravel_percentage, sand_percentage, silt_percentage, clay_percentage,
      cohesion, angle_of_internal_friction, unconfined_compressive_strength,
      compression_index, recompression_index, preconsolidation_pressure,
      permeability_coefficient, cbr_value,
      soil_classification, soil_description, remarks
    } = body;

    const query = `
      UPDATE soil_test_samples 
      SET 
        layer_no = COALESCE($2, layer_no),
        sample_no = COALESCE($3, sample_no),
        depth_from = COALESCE($4, depth_from),
        depth_to = COALESCE($5, depth_to),
        natural_moisture_content = COALESCE($6, natural_moisture_content),
        bulk_density = COALESCE($7, bulk_density),
        dry_density = COALESCE($8, dry_density),
        specific_gravity = COALESCE($9, specific_gravity),
        void_ratio = COALESCE($10, void_ratio),
        porosity = COALESCE($11, porosity),
        degree_of_saturation = COALESCE($12, degree_of_saturation),
        liquid_limit = COALESCE($13, liquid_limit),
        plastic_limit = COALESCE($14, plastic_limit),
        plasticity_index = COALESCE($15, plasticity_index),
        shrinkage_limit = COALESCE($16, shrinkage_limit),
        gravel_percentage = COALESCE($17, gravel_percentage),
        sand_percentage = COALESCE($18, sand_percentage),
        silt_percentage = COALESCE($19, silt_percentage),
        clay_percentage = COALESCE($20, clay_percentage),
        cohesion = COALESCE($21, cohesion),
        angle_of_internal_friction = COALESCE($22, angle_of_internal_friction),
        unconfined_compressive_strength = COALESCE($23, unconfined_compressive_strength),
        compression_index = COALESCE($24, compression_index),
        recompression_index = COALESCE($25, recompression_index),
        preconsolidation_pressure = COALESCE($26, preconsolidation_pressure),
        permeability_coefficient = COALESCE($27, permeability_coefficient),
        cbr_value = COALESCE($28, cbr_value),
        soil_classification = COALESCE($29, soil_classification),
        soil_description = COALESCE($30, soil_description),
        remarks = COALESCE($31, remarks),
        updated_at = NOW()
      WHERE sample_id = $1
      RETURNING *
    `;

    const values = [
      sampleId, layer_no, sample_no, depth_from, depth_to,
      natural_moisture_content, bulk_density, dry_density, specific_gravity,
      void_ratio, porosity, degree_of_saturation,
      liquid_limit, plastic_limit, plasticity_index, shrinkage_limit,
      gravel_percentage, sand_percentage, silt_percentage, clay_percentage,
      cohesion, angle_of_internal_friction, unconfined_compressive_strength,
      compression_index, recompression_index, preconsolidation_pressure,
      permeability_coefficient, cbr_value,
      soil_classification, soil_description, remarks
    ];

    const result = await db.query(query, values);

    if (result.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Soil test sample not found'
      });
    }

    return createResponse(200, {
      success: true,
      message: 'Soil test sample updated successfully',
      data: result[0]
    });
  } catch (error) {
    logger.error('Error updating soil test sample:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete a soil test sample
export const deleteSoilTestSample = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin'])(event);
    if (authError !== null) {
      return authError;
    }

    const sampleId = event.pathParameters?.sampleId;
    if (!sampleId) {
      return createResponse(400, {
        success: false,
        message: 'Sample ID is required'
      });
    }

    const query = 'DELETE FROM soil_test_samples WHERE sample_id = $1 RETURNING *';
    const result = await db.query(query, [sampleId]);

    if (result.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Soil test sample not found'
      });
    }

    return createResponse(200, {
      success: true,
      message: 'Soil test sample deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting soil test sample:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
