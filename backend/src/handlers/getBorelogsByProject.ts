import { APIGatewayProxyEvent } from 'aws-lambda';
import { getBorelogsByProjectId } from '../models/borelogDetails';
import { createResponse } from '../types/common';
import { logger, logRequest, logResponse } from '../utils/logger';
import { validate as validateUUID } from 'uuid';

export const handler = async (event: APIGatewayProxyEvent) => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    const project_id = event.pathParameters?.project_id;

    if (!project_id) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing project_id parameter',
        error: 'project_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    if (!validateUUID(project_id)) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid project_id format',
        error: 'project_id must be a valid UUID'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const borelogs = await getBorelogsByProjectId(project_id);

    const response = createResponse(200, {
      success: true,
      message: 'Borelogs retrieved successfully',
      data: borelogs
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error retrieving borelogs', { error });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve borelogs'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 