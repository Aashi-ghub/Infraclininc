import { APIGatewayProxyEvent } from 'aws-lambda';
import { getBorelogDetailsByBorelogId } from '../models/borelogDetails';
import { createResponse } from '../types/common';
import { logger, logRequest, logResponse } from '../utils/logger';
import { validate as validateUUID } from 'uuid';

export const handler = async (event: APIGatewayProxyEvent) => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
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

    const borelogDetails = await getBorelogDetailsByBorelogId(borelog_id);

    const response = createResponse(200, {
      success: true,
      message: 'Borelog details retrieved successfully',
      data: borelogDetails
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error retrieving borelog details', { error });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve borelog details'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 