import { APIGatewayProxyEvent } from 'aws-lambda';
import { getGeologicalLogsByProjectName } from '../models/geologicalLog';
import { getAllSubstructureAssignments } from '../models/substructureAssignment';
import { createResponse } from '../types/common';
import { logger, logRequest, logResponse } from '../utils/logger';
import { checkRole, validateToken } from '../utils/validateInput';
import { getAssignedBorelogsForSiteEngineer } from '../utils/projectAccess';

export const handler = async (event: APIGatewayProxyEvent) => {
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

    const project_name = event.pathParameters?.project_name;

    if (!project_name) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing project_name parameter',
        error: 'project_name is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Decode URL-encoded project name
    const decodedProjectName = decodeURIComponent(project_name);
    logger.info(`Searching for geological logs with project name: "${decodedProjectName}"`);
    
    let geologicalLogs;
    
    // For Site Engineers, only show assigned geological logs
    if (payload.role === 'Site Engineer') {
      const assignedBorelogIds = await getAssignedBorelogsForSiteEngineer(payload.userId);
      
      if (assignedBorelogIds.length === 0) {
        // No assignments, return empty list
        geologicalLogs = [];
      } else {
        // Get all geological logs for the project and filter by assigned borelog IDs
        const projectLogs = await getGeologicalLogsByProjectName(decodedProjectName);
        geologicalLogs = projectLogs.filter(log => 
          assignedBorelogIds.includes(log.borelog_id)
        );
      }
    } else {
      // For other roles, get all geological logs for the project
      geologicalLogs = await getGeologicalLogsByProjectName(decodedProjectName);
    }
    
    // Get substructure assignments
    const substructureAssignments = await getAllSubstructureAssignments();

    logger.info(`Found ${geologicalLogs.length} geological logs and ${substructureAssignments.length} substructure assignments`);

    const response = createResponse(200, {
      success: true,
      message: 'Geological logs and substructure assignments retrieved successfully',
      data: {
        geologicalLogs,
        substructureAssignments
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error retrieving geological logs by project name with substructures:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve geological logs and substructure assignments'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 
