import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { getSubstructureById } from '../models/structures';
import { createResponse } from '../types/common';
import { validate as validateUUID } from 'uuid';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer'])(event);
    if (authError) {
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

    const substructureId = event.pathParameters?.substructure_id;
    if (!substructureId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing substructure_id parameter',
        error: 'substructure_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    if (!validateUUID(substructureId)) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid substructure_id format',
        error: 'substructure_id must be a valid UUID'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const substructure = await getSubstructureById(substructureId);
    if (!substructure) {
      const response = createResponse(404, {
        success: false,
        message: 'Substructure not found',
        error: 'Substructure with the specified ID does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const response = createResponse(200, {
      success: true,
      message: 'Substructure retrieved successfully',
      data: substructure
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error retrieving substructure:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve substructure'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 
