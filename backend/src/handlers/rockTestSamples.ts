import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole } from '../utils/validateInput';
import { logger } from '../utils/logger';
import { createResponse } from '../types/common';
import * as db from '../db';
import { guardDbRoute } from '../db';

// Get all rock test samples for a report
export const getRockTestSamples = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('getRockTestSamples');
  if (dbGuard) return dbGuard;

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
      SELECT * FROM rock_test_samples 
      WHERE report_id = $1 
      ORDER BY layer_no, sample_no
    `;
    const result = await db.query(query, [reportId]);

    return createResponse(200, {
      success: true,
      message: 'Rock test samples retrieved successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error getting rock test samples:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get a specific rock test sample
export const getRockTestSample = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('getRockTestSample');
  if (dbGuard) return dbGuard;

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

    const query = 'SELECT * FROM rock_test_samples WHERE sample_id = $1';
    const result = await db.query(query, [sampleId]);

    if (result.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Rock test sample not found'
      });
    }

    return createResponse(200, {
      success: true,
      message: 'Rock test sample retrieved successfully',
      data: result[0]
    });
  } catch (error) {
    logger.error('Error getting rock test sample:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update a rock test sample
export const updateRockTestSample = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('updateRockTestSample');
  if (dbGuard) return dbGuard;

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
      porosity, water_absorption,
      unconfined_compressive_strength, point_load_strength_index,
      tensile_strength, shear_strength,
      youngs_modulus, poissons_ratio,
      slake_durability_index, soundness_loss,
      los_angeles_abrasion_value,
      rock_classification, rock_description, rock_quality_designation, remarks
    } = body;

    const query = `
      UPDATE rock_test_samples 
      SET 
        layer_no = COALESCE($2, layer_no),
        sample_no = COALESCE($3, sample_no),
        depth_from = COALESCE($4, depth_from),
        depth_to = COALESCE($5, depth_to),
        natural_moisture_content = COALESCE($6, natural_moisture_content),
        bulk_density = COALESCE($7, bulk_density),
        dry_density = COALESCE($8, dry_density),
        specific_gravity = COALESCE($9, specific_gravity),
        porosity = COALESCE($10, porosity),
        water_absorption = COALESCE($11, water_absorption),
        unconfined_compressive_strength = COALESCE($12, unconfined_compressive_strength),
        point_load_strength_index = COALESCE($13, point_load_strength_index),
        tensile_strength = COALESCE($14, tensile_strength),
        shear_strength = COALESCE($15, shear_strength),
        youngs_modulus = COALESCE($16, youngs_modulus),
        poissons_ratio = COALESCE($17, poissons_ratio),
        slake_durability_index = COALESCE($18, slake_durability_index),
        soundness_loss = COALESCE($19, soundness_loss),
        los_angeles_abrasion_value = COALESCE($20, los_angeles_abrasion_value),
        rock_classification = COALESCE($21, rock_classification),
        rock_description = COALESCE($22, rock_description),
        rock_quality_designation = COALESCE($23, rock_quality_designation),
        remarks = COALESCE($24, remarks),
        updated_at = NOW()
      WHERE sample_id = $1
      RETURNING *
    `;

    const values = [
      sampleId, layer_no, sample_no, depth_from, depth_to,
      natural_moisture_content, bulk_density, dry_density, specific_gravity,
      porosity, water_absorption,
      unconfined_compressive_strength, point_load_strength_index,
      tensile_strength, shear_strength,
      youngs_modulus, poissons_ratio,
      slake_durability_index, soundness_loss,
      los_angeles_abrasion_value,
      rock_classification, rock_description, rock_quality_designation, remarks
    ];

    const result = await db.query(query, values);

    if (result.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Rock test sample not found'
      });
    }

    return createResponse(200, {
      success: true,
      message: 'Rock test sample updated successfully',
      data: result[0]
    });
  } catch (error) {
    logger.error('Error updating rock test sample:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete a rock test sample
export const deleteRockTestSample = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('deleteRockTestSample');
  if (dbGuard) return dbGuard;

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

    const query = 'DELETE FROM rock_test_samples WHERE sample_id = $1 RETURNING *';
    const result = await db.query(query, [sampleId]);

    if (result.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Rock test sample not found'
      });
    }

    return createResponse(200, {
      success: true,
      message: 'Rock test sample deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting rock test sample:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
