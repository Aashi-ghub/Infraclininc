import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { validateInput, checkRole } from '../utils/validateInput';
import { updateGeologicalLog } from '../models/geologicalLog';
import { logger } from '../utils/logger';
import { z } from 'zod';

// Helper function to validate date format (YYYY-MM-DD)
const isValidDateFormat = (date: string) => {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
};

// Schema for update operation
// Note: substructure_id is handled separately through a different endpoint
const UpdateGeologicalLogSchema = z.object({
  // Explicitly reject substructure_id as it should be handled by a separate endpoint
  substructure_id: z.undefined({
    invalid_type_error: "substructure_id cannot be updated through this endpoint. Please use the dedicated substructure assignment endpoint."
  }).optional(),
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
  commencement_date: z.string()
    .refine(val => !val || isValidDateFormat(val), {
      message: "Commencement date must be in YYYY-MM-DD format"
    })
    .optional(),
  completion_date: z.string()
    .refine(val => !val || isValidDateFormat(val), {
      message: "Completion date must be in YYYY-MM-DD format"
    })
    .optional(),
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
    // Check if user has appropriate role (Admin, Project Manager, and Site Engineer can update logs)
    const authError = checkRole(['Admin', 'Project Manager', 'Site Engineer'])(event);
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
    
    // Remove substructure_id if present as it's handled by a separate endpoint
    if ('substructure_id' in body) {
      delete body.substructure_id;
      logger.warn('Ignoring substructure_id in update request as it should be handled by the dedicated endpoint');
    }
    
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