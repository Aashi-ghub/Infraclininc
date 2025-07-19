import { APIGatewayProxyEvent } from 'aws-lambda';
import { getAllGeologicalLogs } from '../models/geologicalLog';
import { createResponse } from '../types/common';
import { logger, logRequest, logResponse } from '../utils/logger';

export const handler = async (event: APIGatewayProxyEvent) => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    const geologicalLogs = await getAllGeologicalLogs();

    const response = createResponse(200, {
      success: true,
      message: 'Geological logs retrieved successfully',
      data: geologicalLogs
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error retrieving all geological logs', { error });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve geological logs'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 