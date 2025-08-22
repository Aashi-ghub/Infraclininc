import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { deleteGeologicalLog } from '../models/geologicalLog';
import { logger, logRequest, logResponse } from '../utils/logger';
import { validate as validateUUID } from 'uuid';
import { checkRole, validateToken } from '../utils/validateInput';
import { createResponse } from '../types/common';
import { checkBorelogAssignment } from '../utils/projectAccess';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role (only Admin, Project Manager, and Site Engineer can delete logs)
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

    if (!validateUUID(borelog_id)) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid borelog_id format',
        error: 'borelog_id must be a valid UUID'
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
          error: 'You can only delete geological logs that are assigned to you'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
    }

    // Delete geological log
    const result = await deleteGeologicalLog(borelog_id);
    
    if (!result) {
      const response = createResponse(404, {
        success: false,
        message: 'Geological log not found',
        error: `No geological log found with ID: ${borelog_id}`
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
    
    const response = createResponse(200, {
      success: true,
      message: 'Geological log deleted successfully',
      data: result
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error deleting geological log:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to delete geological log'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 