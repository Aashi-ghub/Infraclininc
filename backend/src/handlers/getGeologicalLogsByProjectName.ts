import { APIGatewayProxyEvent } from 'aws-lambda';
import { getGeologicalLogsByProjectName } from '../models/geologicalLog';
import { getAllSubstructureAssignments } from '../models/substructureAssignment';
import { createResponse } from '../types/common';
import { logger, logRequest, logResponse } from '../utils/logger';

export const handler = async (event: APIGatewayProxyEvent) => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
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
    
    // Get geological logs and substructure assignments
    const [geologicalLogs, substructureAssignments] = await Promise.all([
      getGeologicalLogsByProjectName(decodedProjectName),
      getAllSubstructureAssignments()
    ]);

    logger.info(`Found ${geologicalLogs.length} geological logs for project: "${decodedProjectName}"`);
    logger.info(`Found ${substructureAssignments.length} substructure assignments`);

    // Create a map of borelog_id to substructure_id
    const substructureMap = new Map();
    substructureAssignments.forEach(assignment => {
      substructureMap.set(assignment.borelog_id, assignment.substructure_id);
    });

    // Add substructure_id to each geological log
    const logsWithSubstructures = geologicalLogs.map(log => ({
      ...log,
      substructure_id: substructureMap.get(log.borelog_id) || null
    }));

    const response = createResponse(200, {
      success: true,
      message: 'Geological logs retrieved successfully',
      data: logsWithSubstructures
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error retrieving geological logs by project name', { error });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve geological logs'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 
