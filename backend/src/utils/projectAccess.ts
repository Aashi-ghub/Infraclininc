import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { validateToken, UserRole } from './validateInput';
import { checkUserProjectAccess } from '../models/userAssignments';
import { createResponse } from '../types/common';
import { logger } from './logger';

export interface ProjectAccessOptions {
  requireEdit?: boolean;
  requireApprove?: boolean;
  allowAdmin?: boolean;
}

export const checkProjectAccess = (options: ProjectAccessOptions = {}) => {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult | null> => {
    try {
      // Extract project ID from path parameters or query string
      const projectId = event.pathParameters?.project_id || 
                       event.queryStringParameters?.project_id ||
                       event.body ? JSON.parse(event.body).project_id : null;

      if (!projectId) {
        return createResponse(400, {
          success: false,
          message: 'Missing project_id',
          error: 'project_id is required for this operation'
        });
      }

      // Get user info from token
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      if (!authHeader) {
        return createResponse(401, {
          success: false,
          message: 'Unauthorized: No token provided',
          error: 'Authentication required'
        });
      }

      const payload = validateToken(authHeader);
      if (!payload) {
        return createResponse(401, {
          success: false,
          message: 'Unauthorized: Invalid token',
          error: 'Invalid authentication token'
        });
      }

      // Admin bypass for certain operations
      if (options.allowAdmin !== false && payload.role === 'Admin') {
        // Add user info to event for handlers to use
        event.user = payload;
        return null; // Allow the request to proceed
      }

      // Check project access
      const access = await checkUserProjectAccess(payload.userId, projectId, payload.role);
      
      if (!access) {
        return createResponse(403, {
          success: false,
          message: 'Forbidden: No access to this project',
          error: 'You are not assigned to this project'
        });
      }

      // Check specific permissions
      if (options.requireEdit && !access.can_edit) {
        return createResponse(403, {
          success: false,
          message: 'Forbidden: Edit permission required',
          error: 'You do not have edit permissions for this project'
        });
      }

      if (options.requireApprove && !access.can_approve) {
        return createResponse(403, {
          success: false,
          message: 'Forbidden: Approval permission required',
          error: 'You do not have approval permissions for this project'
        });
      }

      // Add user info to event for handlers to use
      event.user = payload;
      event.projectAccess = access;

      return null; // Allow the request to proceed
    } catch (error) {
      logger.error('Error checking project access:', error);
      return createResponse(500, {
        success: false,
        message: 'Internal server error',
        error: 'Failed to verify project access'
      });
    }
  };
};

// Helper function to get project ID from various sources
export const extractProjectId = (event: APIGatewayProxyEvent): string | null => {
  return event.pathParameters?.project_id || 
         event.queryStringParameters?.project_id ||
         (event.body ? JSON.parse(event.body).project_id : null);
};

// Helper function to check if user has project access
export const hasProjectAccess = async (
  userId: string, 
  projectId: string, 
  userRole: UserRole,
  requireEdit: boolean = false,
  requireApprove: boolean = false
): Promise<boolean> => {
  try {
    const access = await checkUserProjectAccess(userId, projectId, userRole);
    
    if (!access) {
      return false;
    }

    if (requireEdit && !access.can_edit) {
      return false;
    }

    if (requireApprove && !access.can_approve) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error checking project access:', error);
    return false;
  }
}; 