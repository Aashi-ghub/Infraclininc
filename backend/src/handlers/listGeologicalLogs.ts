import { APIGatewayProxyEvent } from 'aws-lambda';
import { getAllGeologicalLogs } from '../models/geologicalLog';
import { createResponse } from '../types/common';
import { logger, logRequest, logResponse } from '../utils/logger';
import { checkRole, validateToken } from '../utils/validateInput';
import { getAssignedBorelogsForSiteEngineer } from '../utils/projectAccess';
import * as db from '../db';

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

    let geologicalLogs;

    // For Site Engineers, only show assigned geological logs
    if (payload.role === 'Site Engineer') {
      const assignedBorelogIds = await getAssignedBorelogsForSiteEngineer(payload.userId);
      
      if (assignedBorelogIds.length === 0) {
        // No assignments, return empty list
        geologicalLogs = [];
      } else {
        // Get geological logs for assigned borelogs only
        const query = `
          SELECT * FROM geological_logs 
          WHERE borelog_id = ANY($1)
          ORDER BY created_at DESC
        `;
        geologicalLogs = await db.query(query, [assignedBorelogIds]);
      }
    } else {
      // For other roles, get all geological logs
      geologicalLogs = await getAllGeologicalLogs();
    }

    const response = createResponse(200, {
      success: true,
      message: 'Geological logs retrieved successfully',
      data: geologicalLogs
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error retrieving all geological logs', { error });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve geological logs'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 