import { APIGatewayProxyEvent } from 'aws-lambda';
import { createOrUpdateSubstructureAssignment } from '../models/substructureAssignment';
import { getGeologicalLogById } from '../models/geologicalLog';
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

    // Check if the geological log exists
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
    logger.info(`Updating substructure assignment for borelog ${borelog_id} with data:`, { updateData });

    // Extract substructure_id from the request body
    const substructure_id = updateData.substructure_id;

    // Create or update the substructure assignment
    const assignment = await createOrUpdateSubstructureAssignment(borelog_id, substructure_id);

    // Prepare the response data
    const responseData = {
      borelog_id,
      substructure_id: assignment?.substructure_id || null,
      ...geologicalLog
    };

    const response = createResponse(200, {
      success: true,
      message: 'Substructure assignment updated successfully',
      data: responseData
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error updating substructure assignment', { error });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to update substructure assignment'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 
