import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { z } from 'zod';
import { createStorageClient } from '../storage/s3Client';
import { v4 as uuidv4 } from 'uuid';

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  location: z.string().optional(),
  created_by: z.string().optional()
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logger.info('[S3 CREATE ENABLED] createProject');

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Only Admin can create projects
    const authError = await checkRole(['Admin'])(event);
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

    const requestBody = JSON.parse(event.body);
    const validation = CreateProjectSchema.safeParse(requestBody);
    
    if (!validation.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const projectData = validation.data;

    // Generate project_id
    const projectId = uuidv4();
    const createdAt = new Date();

    // Create project object with required fields
    const project = {
      id: projectId,
      project_id: projectId,
      name: projectData.name,
      location: projectData.location || null,
      created_by: projectData.created_by || payload.userId,
      created_at: createdAt.toISOString()
    };

    // Write to S3:
    // - new path: projects/{projectId}/project.json  (primary)
    // - legacy path: projects/project_{projectId}/project.json (backward compatibility)
    const storageClient = createStorageClient();
    const primaryKey = `projects/${projectId}/project.json`;
    const legacyKey = `projects/project_${projectId}/project.json`;
    const minimalProject = {
      project_id: projectId,
      name: projectData.name,
      location: projectData.location || null
    };
    const projectJson = JSON.stringify(project, null, 2);
    const minimalJson = JSON.stringify(minimalProject, null, 2);
    
    await Promise.all([
      storageClient.uploadFile(
        primaryKey,
        Buffer.from(minimalJson, 'utf-8'),
        'application/json'
      ),
      storageClient.uploadFile(
        legacyKey,
      Buffer.from(projectJson, 'utf-8'),
      'application/json'
      )
    ]);

    // Return same response format as before
    const response = createResponse(201, {
      success: true,
      message: 'Project created successfully',
      data: {
        project_id: projectId,
        name: projectData.name,
        location: projectData.location || null,
        created_by: project.created_by,
        created_at: createdAt,
        updated_at: createdAt,
        created_by_user_id: payload.userId
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error creating project:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create project'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 
