import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import * as db from '../db';
import { guardDbRoute } from '../db';
import { getProjectsForSiteEngineer, getProjectDetailsForSiteEngineer } from '../utils/projectAccess';
import { validate as validateUUID } from 'uuid';

export const listProjects = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('listProjects');
  if (dbGuard) return dbGuard;

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

    let projects;

    if (payload.role === 'Site Engineer') {
      // For Site Engineers, get projects with assignment counts
      projects = await getProjectsForSiteEngineer(payload.userId);
    } else {
      // For other roles, get all projects
      const query = `
        SELECT 
          project_id,
          name,
          location,
          created_at,
          0 as assignment_count
        FROM projects
        ORDER BY name
      `;
      projects = await db.query(query);
    }

    const response = createResponse(200, {
      success: true,
      message: 'Projects retrieved successfully',
      data: projects
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error retrieving projects:', error);
    
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
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('getProject');
  if (dbGuard) return dbGuard;

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

    if (!validateUUID(projectId)) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid project_id format',
        error: 'project_id must be a valid UUID'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    let project;

    if (payload.role === 'Site Engineer') {
      // For Site Engineers, get project with assignment details
      project = await getProjectDetailsForSiteEngineer(payload.userId, projectId);
      
      if (!project) {
        const response = createResponse(404, {
          success: false,
          message: 'Project not found or no assignments for this project',
          error: 'Project with the specified ID does not exist or you have no assignments in this project'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
    } else {
      // For other roles, get project details
      const query = `
        SELECT 
          project_id,
          name,
          location,
          created_at
        FROM projects
        WHERE project_id = $1
      `;
      const result = await db.query(query, [projectId]);
      
      if (result.length === 0) {
        const response = createResponse(404, {
          success: false,
          message: 'Project not found',
          error: 'Project with the specified ID does not exist'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
      
      project = result[0];
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
