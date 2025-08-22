import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GeologicalLogSchema, validateInput, checkRole, validateToken } from '../utils/validateInput';
import { insertGeologicalLog } from '../models/geologicalLog';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { checkBorelogAssignment } from '../utils/projectAccess';
import * as db from '../db';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role (Admin, Project Manager, Site Engineer can create logs)
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer'])(event);
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

    // Parse and validate input
    const body = JSON.parse(event.body || '{}');
    const validationResult = validateInput(body, GeologicalLogSchema);
    
    if (!validationResult.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: validationResult.error,
        status: 'error'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // For Site Engineers, check if they are assigned to the borelog
    if (payload.role === 'Site Engineer' && validationResult.data.borelog_id) {
      const isAssigned = await checkBorelogAssignment(payload.userId, validationResult.data.borelog_id);
      
      if (!isAssigned) {
        const response = createResponse(403, {
          success: false,
          message: 'Access denied: Borelog not assigned to you',
          error: 'You can only create geological logs for borelogs that are assigned to you',
          status: 'error'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
    }
    
    // Set created_by_user_id if not provided
    if (!body.created_by_user_id && payload) {
      body.created_by_user_id = payload.userId;
    }
    
    // Create geological log
    const result = await insertGeologicalLog(validationResult.data);
    
    const response = createResponse(201, {
      success: true,
      message: 'Geological log created successfully',
      data: result,
      status: 'success'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error creating geological log:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create geological log',
      status: 'error'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 