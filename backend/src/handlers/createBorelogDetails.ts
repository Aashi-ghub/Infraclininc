import { APIGatewayProxyEvent } from 'aws-lambda';
import { BorelogDetailsSchema } from '../utils/validateInput';
import { insertBorelogDetails } from '../models/borelogDetails';
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

    const data = JSON.parse(event.body);
    const validationResult = BorelogDetailsSchema.safeParse(data);

    if (!validationResult.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation failed',
        error: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    try {
      const borelogDetails = await insertBorelogDetails(validationResult.data);

      const response = createResponse(201, {
        success: true,
        message: 'Borelog details created successfully',
        data: borelogDetails
      });

      logResponse(response, Date.now() - startTime);
      return response;
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        // Handle missing geological log reference
        const response = createResponse(404, {
          success: false,
          message: 'Referenced geological log not found',
          error: error.message
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
      
      // Re-throw for general error handling
      throw error;
    }

  } catch (error) {
    logger.error('Error creating borelog details', { error });
    
    // Check for database constraint errors
    const pgError = error as any;
    if (pgError.code === '23503') {
      const response = createResponse(400, {
        success: false,
        message: 'Foreign key constraint violation',
        error: pgError.detail || 'A referenced record does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create borelog details'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 