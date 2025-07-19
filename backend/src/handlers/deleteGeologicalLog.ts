import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { deleteGeologicalLog } from '../models/geologicalLog';
import { logger, logRequest, logResponse } from '../utils/logger';
import { validate as validateUUID } from 'uuid';
import { checkRole } from '../utils/validateInput';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role (only Admin and Engineer can delete logs)
    const authError = checkRole(['Admin', 'Engineer'])(event);
    if (authError) {
      logResponse(authError, Date.now() - startTime);
      return authError;
    }

    // Get borelog_id from path parameters
    const borelog_id = event.pathParameters?.borelog_id;
    
    if (!borelog_id) {
      const response = {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Missing borelog_id parameter',
          status: 'error'
        })
      };
      logResponse(response, Date.now() - startTime);
      return response;
    }

    if (!validateUUID(borelog_id)) {
      const response = {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Invalid borelog_id format',
          error: 'borelog_id must be a valid UUID',
          status: 'error'
        })
      };
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Delete geological log
    const result = await deleteGeologicalLog(borelog_id);
    
    if (!result) {
      const response = {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Geological log not found or could not be deleted',
          status: 'error'
        })
      };
      logResponse(response, Date.now() - startTime);
      return response;
    }
    
    const response = {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Geological log deleted successfully',
        data: null,
        status: 'success'
      })
    };
    
    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error deleting geological log:', error);
    
    const response = {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Internal server error',
        status: 'error'
      })
    };
    
    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 