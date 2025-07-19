import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { validateInput, checkRole } from '../utils/validateInput';
import { updateGeologicalLog } from '../models/geologicalLog';
import { logger } from '../utils/logger';
import { z } from 'zod';

// Schema for update operation
const UpdateGeologicalLogSchema = z.object({
  project_name: z.string().optional(),
  client_name: z.string().optional(),
  design_consultant: z.string().optional(),
  job_code: z.string().optional(),
  project_location: z.string().optional(),
  chainage_km: z.number().optional().nullable(),
  area: z.string().optional(),
  borehole_location: z.string().optional(),
  borehole_number: z.string().optional(),
  msl: z.string().optional().nullable(),
  method_of_boring: z.string().optional(),
  diameter_of_hole: z.number().optional(),
  commencement_date: z.string().optional(),
  completion_date: z.string().optional(),
  standing_water_level: z.number().optional().nullable(),
  termination_depth: z.number().optional(),
  coordinate: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()])
  }).optional().nullable(),
  type_of_core_barrel: z.string().optional().nullable(),
  bearing_of_hole: z.string().optional().nullable(),
  collar_elevation: z.number().optional().nullable(),
  logged_by: z.string().optional(),
  checked_by: z.string().optional(),
  lithology: z.string().optional().nullable(),
  rock_methodology: z.string().optional().nullable(),
  structural_condition: z.string().optional().nullable(),
  weathering_classification: z.string().optional().nullable(),
  fracture_frequency_per_m: z.number().optional().nullable(),
  size_of_core_pieces_distribution: z.record(z.any()).optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role (only Admin and Engineer can update logs)
    const authError = checkRole(['Admin', 'Engineer'])(event);
    if (authError) {
      return authError;
    }

    // Get borelog_id from path parameters
    const borelog_id = event.pathParameters?.borelog_id;
    
    if (!borelog_id) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Missing borelog_id parameter',
          status: 'error'
        })
      };
    }

    // Parse and validate input
    const body = JSON.parse(event.body || '{}');
    const validationResult = validateInput(body, UpdateGeologicalLogSchema);
    
    if (!validationResult.success) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Validation error',
          errors: validationResult.errors,
          status: 'error'
        })
      };
    }

    // Update geological log
    const result = await updateGeologicalLog(borelog_id, body);
    
    if (!result) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Geological log not found',
          status: 'error'
        })
      };
    }
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Geological log updated successfully',
        data: result,
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error updating geological log:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Internal server error',
        status: 'error'
      })
    };
  }
}; 