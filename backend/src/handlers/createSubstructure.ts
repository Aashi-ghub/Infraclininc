import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { z } from 'zod';
import { createStorageClient } from '../storage/s3Client';
import { v4 as uuidv4 } from 'uuid';
import { parseBody } from '../utils/parseBody';

const CreateSubstructureSchema = z.object({
  structure_id: z.string().uuid('Invalid structure ID'),
  project_id: z.string().uuid('Invalid project ID'),
  type: z.enum(['P1', 'P2', 'M', 'E', 'Abutment1', 'Abutment2', 'LC', 'Right side', 'Left side']),
  remark: z.string().optional()
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Admin and Project Manager can create substructures
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
    const validation = CreateSubstructureSchema.safeParse(requestBody);
    
    if (!validation.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const substructureData = validation.data;

    // Generate substructure_id
    const substructureId = uuidv4();
    const createdAt = new Date();

    // Create substructure object with required fields
    const substructure = {
      substructure_id: substructureId,
      structure_id: substructureData.structure_id,
      project_id: substructureData.project_id,
      type: substructureData.type,
      remark: substructureData.remark || null,
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
      created_by_user_id: payload.userId
    };

    // Write to S3: projects/project_<projectId>/structures/structure_<structureId>/substructures/substructure_<substructureId>/substructure.json
    const storageClient = createStorageClient();
    const s3Key = `projects/project_${substructureData.project_id}/structures/structure_${substructureData.structure_id}/substructures/substructure_${substructureId}/substructure.json`;
    const substructureJson = JSON.stringify(substructure, null, 2);
    
    await storageClient.uploadFile(
      s3Key,
      Buffer.from(substructureJson, 'utf-8'),
      'application/json'
    );

    logger.info(`[S3 CREATE ENABLED] createSubstructure substructure_id=${substructureId} structure_id=${substructureData.structure_id} project_id=${substructureData.project_id}`);

    const response = createResponse(201, {
      success: true,
      message: 'Substructure created successfully',
      data: {
        substructure_id: substructureId,
        structure_id: substructureData.structure_id,
        project_id: substructureData.project_id,
        type: substructureData.type,
        remark: substructureData.remark,
        created_at: createdAt,
        updated_at: createdAt,
        created_by_user_id: payload.userId
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error creating substructure:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create substructure'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 
