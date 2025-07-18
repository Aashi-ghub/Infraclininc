import { APIGatewayProxyEvent } from 'aws-lambda';
import { GeologicalLogSchema } from '../utils/validateInput';
import { insertGeologicalLog } from '../models/geologicalLog';
import { createResponse } from '../types/common';
import { logger, logRequest, logResponse } from '../utils/logger';

export const handler = async (event: APIGatewayProxyEvent) => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    if (!event.body) {
      const response = createResponse(400, {
        success: false,
        message: 'Request body is missing',
        error: 'Missing request body'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    logger.debug('Received request body', { body: event.body });
    
    const data = JSON.parse(event.body);
    const validationResult = GeologicalLogSchema.safeParse(data);

    if (!validationResult.success) {
      logger.warn('Validation failed', { 
        errors: validationResult.error.errors,
        formattedErrors: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      });
      
      const response = createResponse(400, {
        success: false,
        message: 'Validation failed',
        error: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    logger.debug('Validation successful, inserting geological log', { data: validationResult.data });
    
    try {
      const geologicalLog = await insertGeologicalLog(validationResult.data);
      
      logger.info('Geological log created successfully', { borelog_id: geologicalLog.borelog_id });
      
      const response = createResponse(201, {
        success: true,
        message: 'Geological log created successfully',
        data: geologicalLog
      });

      logResponse(response, Date.now() - startTime);
      return response;
    } catch (dbError) {
      logger.error('Database error creating geological log', { error: dbError });
      throw dbError; // Re-throw to be caught by outer catch
    }

  } catch (error) {
    const err = error as Error;
    logger.error('Error creating geological log', { 
      error, 
      errorMessage: err.message || 'Unknown error',
      errorStack: err.stack || 'No stack trace'
    });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create geological log'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 