import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { getAllProjects, getProjectById, getProjectsByUser } from '../models/projects';
import { createResponse } from '../types/common';

export const listProjects = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer'])(event);
    if (authError !== null) {
      return authError;
    }

    // Get user info from token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = await validateToken(authHeader!);
    if (!payload) {
      const response = createResponse(401, {
        success: false,
        message: 'Unauthorized: Invalid token',
        error: 'Invalid token'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get projects based on user role and assignments
    const projects = await getProjectsByUser(payload.userId, payload.role);
    
    const response = createResponse(200, {
      success: true,
      message: 'Projects retrieved successfully',
      data: projects
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error listing projects:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve projects'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

export const getProject = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer'])(event);
    if (authError !== null) {
      return authError;
    }

    const projectId = event.pathParameters?.project_id;
    if (!projectId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing project_id parameter',
        error: 'project_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const project = await getProjectById(projectId);
    if (!project) {
      const response = createResponse(404, {
        success: false,
        message: 'Project not found',
        error: 'Project with the specified ID does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const response = createResponse(200, {
      success: true,
      message: 'Project retrieved successfully',
      data: project
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error retrieving project:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve project'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 