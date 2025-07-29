import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { getStructureById } from '../models/structures';
import { createResponse } from '../types/common';
import { validate as validateUUID } from 'uuid';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = checkRole(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer'])(event);
    if (authError) {
      return authError;
    }

    // Get user info from token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = validateToken(authHeader!);
    if (!payload) {
      const response = createResponse(401, {
        success: false,
        message: 'Unauthorized: Invalid token',
        error: 'Invalid token'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const structureId = event.pathParameters?.structure_id;
    if (!structureId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing structure_id parameter',
        error: 'structure_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    if (!validateUUID(structureId)) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid structure_id format',
        error: 'structure_id must be a valid UUID'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const structure = await getStructureById(structureId);
    if (!structure) {
      const response = createResponse(404, {
        success: false,
        message: 'Structure not found',
        error: 'Structure with the specified ID does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const response = createResponse(200, {
      success: true,
      message: 'Structure retrieved successfully',
      data: structure
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error retrieving structure:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve structure'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 