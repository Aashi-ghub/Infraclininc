import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { z } from 'zod';
import { createStorageClient } from '../storage/s3Client';
import { v4 as uuidv4 } from 'uuid';
import { parseBody } from '../utils/parseBody';

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
    const authError = await checkRole(['Admin', 'Project Manager'])(event);
    if (authError) {
      return authError;
    }

    // Get user info from token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = await validateToken(authHeader!);
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

    const requestBody = parseBody(event);
    if (!requestBody) {
      return createResponse(400, { success: false, message: "Invalid JSON body" });
    }
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

    // Generate structure_id
    const structureId = uuidv4();
    const createdAt = new Date();

    // Create structure object with required fields
    const structure = {
      structure_id: structureId,
      project_id: structureData.project_id,
      type: structureData.type,
      description: structureData.description || null,
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
      created_by_user_id: payload.userId
    };

    // Write to S3: projects/project_<projectId>/structures/structure_<structureId>/structure.json
    const storageClient = createStorageClient();
    const s3Key = `projects/project_${structureData.project_id}/structures/structure_${structureId}/structure.json`;
    const structureJson = JSON.stringify(structure, null, 2);
    
    await storageClient.uploadFile(
      s3Key,
      Buffer.from(structureJson, 'utf-8'),
      'application/json'
    );

    logger.info(`[S3 CREATE ENABLED] createStructure structure_id=${structureId} project_id=${structureData.project_id}`);

    const response = createResponse(201, {
      success: true,
      message: 'Structure created successfully',
      data: {
        structure_id: structureId,
        project_id: structureData.project_id,
        type: structureData.type,
        description: structureData.description,
        created_at: createdAt,
        updated_at: createdAt,
        created_by_user_id: payload.userId
      }
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
