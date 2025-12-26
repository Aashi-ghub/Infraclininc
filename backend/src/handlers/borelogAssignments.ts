import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { z } from 'zod';
import * as db from '../db';
import { guardDbRoute } from '../db';
import {
  createBorelogAssignment,
  updateBorelogAssignment,
  getBorelogAssignmentsByBorelogId,
  getBorelogAssignmentsByStructureId,
  getBorelogAssignmentsBySiteEngineer,
  getActiveBorelogAssignments,
  deleteBorelogAssignment,
  CreateBorelogAssignmentInput,
  UpdateBorelogAssignmentInput
} from '../models/borelogAssignments';

// Schema for creating borelog assignments
const CreateBorelogAssignmentSchema = z.object({
  borelog_id: z.string().uuid('Invalid borelog ID').optional(),
  structure_id: z.string().uuid('Invalid structure ID').optional(),
  substructure_id: z.string().uuid('Invalid substructure ID').optional(),
  assigned_site_engineer: z.string().uuid('Invalid site engineer ID'),
  notes: z.string().optional(),
  expected_completion_date: z.string().optional().transform(val => val ? new Date(val) : undefined)
}).refine(data => data.borelog_id || data.structure_id || data.substructure_id, {
  message: 'At least one of borelog_id, structure_id, or substructure_id must be provided'
});

// Schema for updating borelog assignments
const UpdateBorelogAssignmentSchema = z.object({
  status: z.enum(['active', 'inactive', 'completed']).optional(),
  notes: z.string().optional(),
  expected_completion_date: z.string().optional().transform(val => val ? new Date(val) : undefined),
  completed_at: z.string().optional().transform(val => val ? new Date(val) : undefined)
});

// Create borelog assignment
export const createAssignment = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('createAssignment');
  if (dbGuard) return dbGuard;

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Only Admin can create borelog assignments
    const authError = await checkRole(['Admin'])(event);
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
    const validation = CreateBorelogAssignmentSchema.safeParse(requestBody);
    
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

    // Create the assignment
    const assignment = await createBorelogAssignment({
      ...assignmentData,
      assigned_by: payload.userId
    });

    const response = createResponse(201, {
      success: true,
      message: 'Borelog assignment created successfully',
      data: assignment
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error: any) {
    logger.error('Error creating borelog assignment:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error.message || 'Failed to create borelog assignment'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Update borelog assignment
export const updateAssignment = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('updateAssignment');
  if (dbGuard) return dbGuard;

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Only Admin can update borelog assignments
    const authError = await checkRole(['Admin'])(event);
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

    const assignmentId = event.pathParameters?.assignmentId;
    if (!assignmentId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing assignment ID',
        error: 'Assignment ID is required'
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
    const validation = UpdateBorelogAssignmentSchema.safeParse(requestBody);
    
    if (!validation.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const updateData = validation.data;

    // Update the assignment
    const assignment = await updateBorelogAssignment(assignmentId, updateData);

    const response = createResponse(200, {
      success: true,
      message: 'Borelog assignment updated successfully',
      data: assignment
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error: any) {
    logger.error('Error updating borelog assignment:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error.message || 'Failed to update borelog assignment'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Get borelog assignments by borelog ID
export const getAssignmentsByBorelogId = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('getAssignmentsByBorelogId');
  if (dbGuard) return dbGuard;

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer'])(event);
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

    const borelogId = event.pathParameters?.borelogId;
    if (!borelogId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing borelog ID',
        error: 'Borelog ID is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get assignments for the borelog
    const assignments = await getBorelogAssignmentsByBorelogId(borelogId);

    const response = createResponse(200, {
      success: true,
      message: 'Borelog assignments retrieved successfully',
      data: assignments
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error: any) {
    logger.error('Error getting borelog assignments by borelog ID:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error.message || 'Failed to get borelog assignments'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Get borelog assignments by structure ID
export const getAssignmentsByStructureId = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('getAssignmentsByStructureId');
  if (dbGuard) return dbGuard;

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer'])(event);
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

    const structureId = event.pathParameters?.structureId;
    if (!structureId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing structure ID',
        error: 'Structure ID is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get assignments for the structure
    const assignments = await getBorelogAssignmentsByStructureId(structureId);

    const response = createResponse(200, {
      success: true,
      message: 'Structure assignments retrieved successfully',
      data: assignments
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error: any) {
    logger.error('Error getting borelog assignments by structure ID:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error.message || 'Failed to get structure assignments'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Get borelog assignments by site engineer
export const getAssignmentsBySiteEngineer = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('getAssignmentsBySiteEngineer');
  if (dbGuard) return dbGuard;

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer'])(event);
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

    const siteEngineerId = event.pathParameters?.siteEngineerId;
    if (!siteEngineerId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing site engineer ID',
        error: 'Site engineer ID is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get assignments for the site engineer
    const assignments = await getBorelogAssignmentsBySiteEngineer(siteEngineerId);

    const response = createResponse(200, {
      success: true,
      message: 'Site engineer assignments retrieved successfully',
      data: assignments
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error: any) {
    logger.error('Error getting borelog assignments by site engineer:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error.message || 'Failed to get site engineer assignments'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Get all active borelog assignments
export const getActiveAssignments = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('getActiveAssignments');
  if (dbGuard) return dbGuard;

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager'])(event);
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

    // Get all active assignments
    const assignments = await getActiveBorelogAssignments();

    const response = createResponse(200, {
      success: true,
      message: 'Active borelog assignments retrieved successfully',
      data: assignments
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error: any) {
    logger.error('Error getting active borelog assignments:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error.message || 'Failed to get active assignments'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Delete borelog assignment
export const deleteAssignment = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('deleteAssignment');
  if (dbGuard) return dbGuard;

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Only Admin can delete borelog assignments
    const authError = await checkRole(['Admin'])(event);
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

    const assignmentId = event.pathParameters?.assignmentId;
    if (!assignmentId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing assignment ID',
        error: 'Assignment ID is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Delete the assignment
    await deleteBorelogAssignment(assignmentId);

    const response = createResponse(200, {
      success: true,
      message: 'Borelog assignment deleted successfully'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error: any) {
    logger.error('Error deleting borelog assignment:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error.message || 'Failed to delete borelog assignment'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Get borelog assignments for the current user (site engineer)
export const getMyAssignments = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('getMyAssignments');
  if (dbGuard) return dbGuard;

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Site Engineer'])(event);
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

    // Get assignments for the current user
    const assignments = await getBorelogAssignmentsBySiteEngineer(payload.userId);

    const response = createResponse(200, {
      success: true,
      message: 'My assignments retrieved successfully',
      data: assignments
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error: any) {
    logger.error('Error getting my borelog assignments:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error.message || 'Failed to get my assignments'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};
