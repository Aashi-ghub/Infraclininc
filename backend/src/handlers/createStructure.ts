import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createStructure } from '../models/structures';
import { createResponse } from '../types/common';
import { z } from 'zod';

const CreateStructureSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  type: z.enum(['Tunnel', 'Bridge', 'LevelCrossing', 'Viaduct', 'Embankment', 'Alignment', 'Yeard', 'StationBuilding', 'Building', 'SlopeStability']),
  description: z.string().optional()
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Admin and Project Manager can create structures
    const authError = checkRole(['Admin', 'Project Manager'])(event);
    if (authError) {
      return authError;
    }

    // Get user info from token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = validateToken(authHeader!);
    if (!payload) {
      const response = createResponse(401, {
        success: false,
        message: 'Unauthorized: Invalid token',
        status: 'error'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Parse and validate request body
    if (!event.body) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing request body',
        error: 'Request body is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const requestBody = JSON.parse(event.body);
    const validation = CreateStructureSchema.safeParse(requestBody);
    
    if (!validation.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const structureData = validation.data;

    // Create structure with user ID
    const structure = await createStructure({
      ...structureData,
      created_by_user_id: payload.userId
    });

    const response = createResponse(201, {
      success: true,
      message: 'Structure created successfully',
      data: structure
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error creating structure:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create structure'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 