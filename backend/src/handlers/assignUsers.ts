import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createUserAssignment } from '../models/userAssignments';
import { createResponse } from '../types/common';
import { z } from 'zod';

const AssignUsersSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  assignment_type: z.enum(['AdminToManager', 'ManagerToTeam']),
  assigner: z.array(z.string().uuid('Invalid assigner ID')),
  assignee: z.array(z.string().uuid('Invalid assignee ID'))
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Only Admin can assign users to projects
    const authError = checkRole(['Admin'])(event);
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
    const validation = AssignUsersSchema.safeParse(requestBody);
    
    if (!validation.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const assignmentData = validation.data;

    // Create user assignment
    const assignment = await createUserAssignment({
      ...assignmentData,
      created_by_user_id: payload.userId
    });

    const response = createResponse(201, {
      success: true,
      message: 'Users assigned to project successfully',
      data: assignment
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error assigning users to project:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to assign users to project'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 