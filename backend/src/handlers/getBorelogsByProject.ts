import { APIGatewayProxyEvent } from 'aws-lambda';
import { getGeologicalLogsByProjectName } from '../models/geologicalLog';
import { createResponse } from '../types/common';
import { logger, logRequest, logResponse } from '../utils/logger';

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

    // Using project_id as project_name (from URL parameter)
    const project_name = decodeURIComponent(project_id);
    logger.info(`Retrieving borelogs for project: ${project_name}`);

    try {
      const borelogs = await getGeologicalLogsByProjectName(project_name);

      // Return empty array if no borelogs found
      const response = createResponse(200, {
        success: true,
        message: borelogs.length > 0 
          ? 'Borelogs retrieved successfully' 
          : 'No borelogs found for this project',
        data: borelogs
      });

      logResponse(response, Date.now() - startTime);
      return response;
    } catch (dbError) {
      logger.error('Database error retrieving borelogs', { 
        error: dbError, 
        project_name,
        errorMessage: (dbError as Error).message,
        errorStack: (dbError as Error).stack
      });
      
      // Check for specific database errors that might need custom handling
      const errorMessage = (dbError as Error).message;
      if (errorMessage.includes('JSON')) {
        const response = createResponse(500, {
          success: false,
          message: 'Error processing database results',
          error: 'Invalid data format in database'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
      
      throw dbError;
    }

  } catch (error) {
    logger.error('Error retrieving borelogs', { 
      error,
      errorMessage: (error as Error).message,
      errorStack: (error as Error).stack
    });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve borelogs'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 