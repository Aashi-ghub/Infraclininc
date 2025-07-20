import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole } from '../utils/validateInput';
import { logger } from '../utils/logger';
import { query } from '../db';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Validation schemas
const LabTestSchema = z.object({
  borelog_id: z.string().uuid(),
  permeability_test: z.string().optional(),
  spt_blows_per_15cm: z.number().optional(),
  n_value_is2131: z.string().optional(),
  total_core_length_cm: z.number().optional(),
  tcr_percent: z.number().optional(),
  rqd_length_cm: z.number().optional(),
  rqd_percent: z.number().optional(),
  test_section_m: z.string().optional(),
  lugeon_value: z.string().optional(),
  special_observations: z.string().optional()
});

// Lab Engineer Handlers
export const addLabTestResults = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authError = checkRole(['Lab Engineer'])(event);
    if (authError) return authError;

    const body = JSON.parse(event.body || '{}');
    const validationResult = LabTestSchema.safeParse(body);

    if (!validationResult.success) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'Validation error',
          errors: validationResult.error.errors,
          status: 'error'
        })
      };
    }

    const testData = validationResult.data;
    const userId = event.user?.userId;

    // Update geological log with test results
    const result = await query(
      `UPDATE geological_log 
       SET 
         permeability_test = COALESCE($1, permeability_test),
         spt_blows_per_15cm = COALESCE($2, spt_blows_per_15cm),
         n_value_is2131 = COALESCE($3, n_value_is2131),
         total_core_length_cm = COALESCE($4, total_core_length_cm),
         tcr_percent = COALESCE($5, tcr_percent),
         rqd_length_cm = COALESCE($6, rqd_length_cm),
         rqd_percent = COALESCE($7, rqd_percent),
         test_section_m = COALESCE($8, test_section_m),
         lugeon_value = COALESCE($9, lugeon_value),
         special_observations = COALESCE($10, special_observations),
         updated_at = NOW()
       WHERE borelog_id = $11
       RETURNING *`,
      [
        testData.permeability_test,
        testData.spt_blows_per_15cm,
        testData.n_value_is2131,
        testData.total_core_length_cm,
        testData.tcr_percent,
        testData.rqd_length_cm,
        testData.rqd_percent,
        testData.test_section_m,
        testData.lugeon_value,
        testData.special_observations,
        testData.borelog_id
      ]
    );

    if (result.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'Geological log not found',
          status: 'error'
        })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Lab test results added successfully',
        data: result[0],
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error adding lab test results:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Internal server error',
        status: 'error'
      })
    };
  }
};

export const getLabTestsByProject = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authError = checkRole(['Lab Engineer'])(event);
    if (authError) return authError;

    const projectName = event.queryStringParameters?.project_name;
    if (!projectName) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'Project name is required',
          status: 'error'
        })
      };
    }

    // Get all logs for the project that have test data
    const logs = await query(
      `SELECT * FROM geological_log 
       WHERE project_name = $1 
       AND (
         permeability_test IS NOT NULL OR
         spt_blows_per_15cm IS NOT NULL OR
         total_core_length_cm IS NOT NULL OR
         tcr_percent IS NOT NULL
       )
       ORDER BY created_at DESC`,
      [projectName]
    );

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Lab tests retrieved successfully',
        data: logs,
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error getting lab tests:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Internal server error',
        status: 'error'
      })
    };
  }
};

export const updateLabTestResults = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authError = checkRole(['Lab Engineer'])(event);
    if (authError) return authError;

    const borelogId = event.pathParameters?.borelog_id;
    if (!borelogId) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'Borelog ID is required',
          status: 'error'
        })
      };
    }

    const body = JSON.parse(event.body || '{}');
    const validationResult = LabTestSchema.partial().safeParse(body);

    if (!validationResult.success) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'Validation error',
          errors: validationResult.error.errors,
          status: 'error'
        })
      };
    }

    const updateData = validationResult.data;

    // Update test results
    const result = await query(
      `UPDATE geological_log 
       SET 
         permeability_test = COALESCE($1, permeability_test),
         spt_blows_per_15cm = COALESCE($2, spt_blows_per_15cm),
         n_value_is2131 = COALESCE($3, n_value_is2131),
         total_core_length_cm = COALESCE($4, total_core_length_cm),
         tcr_percent = COALESCE($5, tcr_percent),
         rqd_length_cm = COALESCE($6, rqd_length_cm),
         rqd_percent = COALESCE($7, rqd_percent),
         updated_at = NOW()
       WHERE borelog_id = $8
       RETURNING *`,
      [
        updateData.permeability_test,
        updateData.spt_blows_per_15cm,
        updateData.n_value_is2131,
        updateData.total_core_length_cm,
        updateData.tcr_percent,
        updateData.rqd_length_cm,
        updateData.rqd_percent,
        borelogId
      ]
    );

    if (result.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'Geological log not found',
          status: 'error'
        })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Lab test results updated successfully',
        data: result[0],
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error updating lab test results:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Internal server error',
        status: 'error'
      })
    };
  }
}; 