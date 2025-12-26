import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import * as db from '../db';
import { guardDbRoute } from '../db';
import { validate as validateUUID } from 'uuid';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('getBorelogBasicInfo');
  if (dbGuard) return dbGuard;

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer'])(event);
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
        error: 'Invalid token'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const borelogId = event.pathParameters?.borelog_id;
    if (!borelogId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing borelog_id parameter',
        error: 'borelog_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    if (!validateUUID(borelogId)) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid borelog_id format',
        error: 'borelog_id must be a valid UUID'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get basic borelog info including substructure_id
    const query = `
      SELECT 
        b.borelog_id,
        b.substructure_id,
        b.project_id,
        b.type as borelog_type,
        b.created_at,
        ss.type as substructure_type,
        s.type as structure_type,
        p.name as project_name
      FROM boreloge b
      JOIN sub_structures ss ON b.substructure_id = ss.substructure_id
      JOIN structure s ON ss.structure_id = s.structure_id
      JOIN projects p ON b.project_id = p.project_id
      WHERE b.borelog_id = $1
    `;

    const result = await db.query(query, [borelogId]);

    if (result.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: 'No borelog found with the specified borelog_id'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const borelogInfo = result[0];

    const response = createResponse(200, {
      success: true,
      message: 'Borelog basic info retrieved successfully',
      data: {
        borelog_id: borelogInfo.borelog_id,
        substructure_id: borelogInfo.substructure_id,
        project_id: borelogInfo.project_id,
        borelog_type: borelogInfo.borelog_type,
        created_at: borelogInfo.created_at,
        substructure_type: borelogInfo.substructure_type,
        structure_type: borelogInfo.structure_type,
        project_name: borelogInfo.project_name
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error retrieving borelog basic info:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve borelog basic info'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

