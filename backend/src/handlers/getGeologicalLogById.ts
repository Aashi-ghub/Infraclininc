import { APIGatewayProxyEvent } from 'aws-lambda';
import { getGeologicalLogById } from '../models/geologicalLog';
import { getSubstructureAssignment } from '../models/substructureAssignment';
import { createResponse } from '../types/common';
import { logger, logRequest, logResponse } from '../utils/logger';
import { validate as validateUUID } from 'uuid';
import { checkRole, validateToken } from '../utils/validateInput';
import { checkBorelogAssignment } from '../utils/projectAccess';

export const handler = async (event: APIGatewayProxyEvent) => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer'])(event);
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

    const geologicalLog = await getGeologicalLogById(borelog_id);

    if (!geologicalLog) {
      const response = createResponse(404, {
        success: false,
        message: 'Geological log not found',
        error: `No geological log found with ID: ${borelog_id}`
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get the substructure assignment for this borelog
    const substructureAssignment = await getSubstructureAssignment(borelog_id);
    
    // For Site Engineers, check if they are assigned to this borelog
    if (payload.role === 'Site Engineer') {
      const isAssigned = await checkBorelogAssignment(
        payload.userId, 
        borelog_id, 
        substructureAssignment?.substructure_id
      );
      
      if (!isAssigned) {
        const response = createResponse(403, {
          success: false,
          message: 'Access denied: Borelog not assigned to you',
          error: 'You can only access geological logs that are assigned to you'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
    }
    
    // Add the substructure_id to the geological log
    const logWithSubstructure = {
      ...geologicalLog,
      substructure_id: substructureAssignment?.substructure_id || null
    };

    const response = createResponse(200, {
      success: true,
      message: 'Geological log retrieved successfully',
      data: logWithSubstructure
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error retrieving geological log', { error });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve geological log'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 