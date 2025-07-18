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

    let data;
    try {
      data = JSON.parse(event.body);
    } catch (parseError) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid JSON in request body',
        error: (parseError as Error).message
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

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
    } catch (dbError) {
      // More specific error handling for database errors
      logger.error('Database error creating borelog details', { 
        error: dbError, 
        errorMessage: (dbError as Error).message,
        errorStack: (dbError as Error).stack
      });
      
      // Check for specific error messages
      const errorMessage = (dbError as Error).message;
      if (errorMessage.includes('required project or substructure does not exist')) {
        const response = createResponse(400, {
          success: false,
          message: 'Missing required references',
          error: 'A valid project and substructure must exist in the database'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
      
      throw dbError; // Re-throw for general error handling
    }

  } catch (error) {
    logger.error('Error creating borelog details', { 
      error,
      errorMessage: (error as Error).message,
      errorStack: (error as Error).stack
    });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create borelog details'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 