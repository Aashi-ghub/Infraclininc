import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { updateGeologicalLog } from '../models/geologicalLog';
import { validateInput, checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { checkBorelogAssignment } from '../utils/projectAccess';
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
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role (Admin, Project Manager, and Site Engineer can update logs)
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer'])(event);
    if (authError !== null) {
      return authError;
    }

    // Get user info from token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = await validateToken(authHeader!);
    if (!payload) {
      const response = createResponse(401, {
        success: false,
        message: 'Unauthorized: Invalid token',
        error: 'Invalid token'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get borelog_id from path parameters
    const borelog_id = event.pathParameters?.borelog_id;
    
    if (!borelog_id) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing borelog_id parameter',
        error: 'borelog_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // For Site Engineers, check if they are assigned to this borelog
    if (payload.role === 'Site Engineer') {
      const isAssigned = await checkBorelogAssignment(payload.userId, borelog_id);
      
      if (!isAssigned) {
        const response = createResponse(403, {
          success: false,
          message: 'Access denied: Borelog not assigned to you',
          error: 'You can only update geological logs that are assigned to you'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
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
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        errors: validationResult.errors,
        status: 'error'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Update geological log
    const result = await updateGeologicalLog(borelog_id, body);
    
    if (!result) {
      const response = createResponse(404, {
        success: false,
        message: 'Geological log not found',
        error: `No geological log found with ID: ${borelog_id}`,
        status: 'error'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
    
    const response = createResponse(200, {
      success: true,
      message: 'Geological log updated successfully',
      data: result,
      status: 'success'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error updating geological log:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to update geological log',
      status: 'error'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 