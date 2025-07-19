import { APIGatewayProxyEvent } from 'aws-lambda';
import { updateGeologicalLog } from '../models/geologicalLog';
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

    // Parse request body
    if (!event.body) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing request body',
        error: 'Request body is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const updateData = JSON.parse(event.body);
    logger.info(`Updating geological log ${borelog_id} with data:`, { updateData });

    const updatedLog = await updateGeologicalLog(borelog_id, updateData);

    if (!updatedLog) {
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
      message: 'Geological log updated successfully',
      data: updatedLog
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error updating geological log', { error });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to update geological log'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 