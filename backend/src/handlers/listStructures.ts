import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { getStructuresByProject } from '../models/structures';
import { createResponse } from '../types/common';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

    const projectId = event.queryStringParameters?.project_id;
    if (!projectId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing project_id parameter',
        error: 'project_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const structures = await getStructuresByProject(projectId);
    
    const response = createResponse(200, {
      success: true,
      message: 'Structures retrieved successfully',
      data: structures
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error listing structures:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve structures'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 