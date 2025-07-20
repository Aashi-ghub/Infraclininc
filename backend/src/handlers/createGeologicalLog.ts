import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GeologicalLogSchema, validateInput, checkRole } from '../utils/validateInput';
import { insertGeologicalLog } from '../models/geologicalLog';
import { logger } from '../utils/logger';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role (Admin, Engineer, or Logger can create logs)
    const authError = checkRole(['Admin', 'Engineer', 'Logger'])(event);
    if (authError) {
      return authError;
    }

    // Parse and validate input
    const body = JSON.parse(event.body || '{}');
    const validationResult = validateInput(body, GeologicalLogSchema);
    
    if (!validationResult.success) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Validation error',
          error: validationResult.error,
          status: 'error'
        })
      };
    }

    // Get user info from event (added by checkRole middleware)
    const user = event.user;
    
    // Set created_by_user_id if not provided
    if (!body.created_by_user_id && user) {
      body.created_by_user_id = user.userId;
    }
    
    // Create geological log
    const result = await insertGeologicalLog(validationResult.data);
    
    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Geological log created successfully',
        data: result,
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error creating geological log:', error);
    return {
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
  }
}; 