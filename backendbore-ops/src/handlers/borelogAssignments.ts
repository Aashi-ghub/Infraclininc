import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { z } from 'zod';
import { createStorageClient } from '../storage/s3Client';
import * as userStore from '../auth/userStore';
import { v4 as uuidv4 } from 'uuid';

/**
 * MIGRATED: This handler now reads from S3 instead of database
 * S3 Structure:
 * - Assignments: assignments/{assignment_id}.json (individual files)
 * - Or: assignments/borelog_{borelogId}.json (grouped by borelog)
 * - Or: assignments/all.json (single file with all assignments)
 */

interface BorelogAssignment {
  assignment_id: string;
  borelog_id?: string;
  structure_id?: string;
  substructure_id?: string;
  assigned_site_engineer: string;
  assigned_by: string;
  assigned_at: Date | string;
  status: 'active' | 'inactive' | 'completed';
  notes?: string;
  expected_completion_date?: Date | string;
  completed_at?: Date | string;
}

// Schema for creating borelog assignments
const CreateBorelogAssignmentSchema = z.object({
  borelog_id: z.string().uuid('Invalid borelog ID').optional(),
  structure_id: z.string().uuid('Invalid structure ID').optional(),
  substructure_id: z.string().uuid('Invalid substructure ID').optional(),
  assigned_site_engineer: z.string().min(1, 'Site engineer ID is required'), // Accept any string format (not just UUID)
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

/**
 * Save assignments to S3
 * Strategy: Use assignments/all.json for efficient reads
 */
async function saveAssignmentsToS3(
  storageClient: ReturnType<typeof createStorageClient>,
  assignments: BorelogAssignment[]
): Promise<void> {
  const key = 'assignments/all.json';
  const json = JSON.stringify(assignments, null, 2);
  await storageClient.uploadFile(key, Buffer.from(json, 'utf-8'), 'application/json');
}

/**
 * Create a new assignment in S3
 */
async function createBorelogAssignmentInS3(
  storageClient: ReturnType<typeof createStorageClient>,
  assignmentData: {
    borelog_id?: string;
    structure_id?: string;
    substructure_id?: string;
    assigned_site_engineer: string;
    assigned_by: string;
    notes?: string;
    expected_completion_date?: Date;
  }
): Promise<BorelogAssignment> {
  // Validate that at least one target is provided
  if (!assignmentData.borelog_id && !assignmentData.structure_id && !assignmentData.substructure_id) {
    throw new Error('At least one of borelog_id, structure_id, or substructure_id must be provided');
  }

  // Check if the site engineer exists and has the correct role
  const allUsers = await userStore.getAllUsers();
  const siteEngineer = allUsers.find(
    u => (u.user_id === assignmentData.assigned_site_engineer || u.id === assignmentData.assigned_site_engineer) &&
         u.role === 'Site Engineer'
  );
  
  if (!siteEngineer) {
    throw new Error('User not found or is not a Site Engineer');
  }

  // Read existing assignments
  const allAssignments = await readAllAssignmentsFromS3(storageClient);

  // Check for existing active assignment
  const existingActive = allAssignments.find(a => {
    const matchesTarget = 
      (assignmentData.borelog_id && a.borelog_id === assignmentData.borelog_id) ||
      (assignmentData.structure_id && a.structure_id === assignmentData.structure_id) ||
      (assignmentData.substructure_id && a.substructure_id === assignmentData.substructure_id);
    const matchesEngineer = a.assigned_site_engineer === assignmentData.assigned_site_engineer;
    return matchesTarget && matchesEngineer && a.status === 'active';
  });

  if (existingActive) {
    throw new Error('Site Engineer already has an active assignment for this target');
  }

  // Create new assignment
  const assignmentId = uuidv4();
  const now = new Date().toISOString();
  const newAssignment: BorelogAssignment = {
    assignment_id: assignmentId,
    borelog_id: assignmentData.borelog_id,
    structure_id: assignmentData.structure_id,
    substructure_id: assignmentData.substructure_id,
    assigned_site_engineer: assignmentData.assigned_site_engineer,
    assigned_by: assignmentData.assigned_by,
    assigned_at: now,
    status: 'active',
    notes: assignmentData.notes,
    expected_completion_date: assignmentData.expected_completion_date?.toISOString()
  };

  // Add to list and save
  allAssignments.push(newAssignment);
  await saveAssignmentsToS3(storageClient, allAssignments);

  return {
    ...newAssignment,
    assigned_at: new Date(newAssignment.assigned_at),
    expected_completion_date: newAssignment.expected_completion_date ? new Date(newAssignment.expected_completion_date) : undefined
  };
}

// Create borelog assignment
export const createAssignment = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // MIGRATED: Removed DB guard - now S3-only
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

    // Create the assignment in S3
    const storageClient = createStorageClient();
    const assignment = await createBorelogAssignmentInS3(storageClient, {
      ...assignmentData,
      assigned_by: payload.userId,
      expected_completion_date: assignmentData.expected_completion_date
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
    
    const statusCode = error.message.includes('already has') ? 409 : 
                      error.message.includes('not found') ? 404 : 500;
    
    const response = createResponse(statusCode, {
      success: false,
      message: 'Internal server error',
      error: error.message || 'Failed to create borelog assignment'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

/**
 * Update an assignment in S3
 */
async function updateBorelogAssignmentInS3(
  storageClient: ReturnType<typeof createStorageClient>,
  assignmentId: string,
  updateData: {
    status?: 'active' | 'inactive' | 'completed';
    notes?: string;
    expected_completion_date?: Date;
    completed_at?: Date;
  }
): Promise<BorelogAssignment> {
  const allAssignments = await readAllAssignmentsFromS3(storageClient);
  const assignmentIndex = allAssignments.findIndex(a => a.assignment_id === assignmentId);

  if (assignmentIndex === -1) {
    throw new Error('Assignment not found');
  }

  const assignment = allAssignments[assignmentIndex];
  const updatedAssignment: BorelogAssignment = {
    ...assignment,
    status: updateData.status ?? assignment.status,
    notes: updateData.notes !== undefined ? updateData.notes : assignment.notes,
    expected_completion_date: updateData.expected_completion_date 
      ? updateData.expected_completion_date.toISOString() 
      : assignment.expected_completion_date,
    completed_at: updateData.completed_at 
      ? updateData.completed_at.toISOString() 
      : assignment.completed_at
  };

  allAssignments[assignmentIndex] = updatedAssignment;
  await saveAssignmentsToS3(storageClient, allAssignments);

  return {
    ...updatedAssignment,
    assigned_at: new Date(updatedAssignment.assigned_at),
    expected_completion_date: updatedAssignment.expected_completion_date ? new Date(updatedAssignment.expected_completion_date) : undefined,
    completed_at: updatedAssignment.completed_at ? new Date(updatedAssignment.completed_at) : undefined
  };
}

// Update borelog assignment
export const updateAssignment = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // MIGRATED: Removed DB guard - now S3-only

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

    // Update the assignment in S3
    const storageClient = createStorageClient();
    const assignment = await updateBorelogAssignmentInS3(storageClient, assignmentId, {
      status: updateData.status,
      notes: updateData.notes,
      expected_completion_date: updateData.expected_completion_date,
      completed_at: updateData.completed_at
    });

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

/**
 * Read all assignments from S3
 */
async function readAllAssignmentsFromS3(
  storageClient: ReturnType<typeof createStorageClient>
): Promise<BorelogAssignment[]> {
  try {
    // Try reading from a single file first (most efficient)
    try {
      const key = 'assignments/all.json';
      const buf = await storageClient.downloadFile(key);
      const assignments = JSON.parse(buf.toString('utf-8')) as BorelogAssignment[];
      return assignments;
    } catch (error: any) {
      // If all.json doesn't exist (NoSuchKey), return empty array
      if (error?.name === 'NoSuchKey' || error?.Code === 'NoSuchKey') {
        return [];
      }
      
      // If all.json doesn't exist, try reading individual files
      try {
        const keys = await storageClient.listFiles('assignments/', 10000);
        const assignmentKeys = keys.filter(k => k.endsWith('.json') && !k.endsWith('/all.json'));
        
        const assignments: BorelogAssignment[] = [];
        for (const key of assignmentKeys) {
          try {
            const buf = await storageClient.downloadFile(key);
            const assignment = JSON.parse(buf.toString('utf-8')) as BorelogAssignment;
            assignments.push(assignment);
          } catch {
            // Skip invalid files
            continue;
          }
        }
        return assignments;
      } catch {
        // If listing also fails, return empty array
        return [];
      }
    }
  } catch (error) {
    logger.warn('Could not read assignments from S3, returning empty array', { error });
    return [];
  }
}

// Get borelog assignments by borelog ID
export const getAssignmentsByBorelogId = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // MIGRATED: Removed DB guard - now S3-only
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

    // Initialize S3 storage client
    const storageClient = createStorageClient();

    // Read all assignments from S3
    const allAssignments = await readAllAssignmentsFromS3(storageClient);

    // Filter assignments for this borelog
    const assignments = allAssignments
      .filter(a => a.borelog_id === borelogId)
      .map(a => ({
        ...a,
        assigned_at: new Date(a.assigned_at),
        completed_at: a.completed_at ? new Date(a.completed_at) : undefined,
        expected_completion_date: a.expected_completion_date ? new Date(a.expected_completion_date) : undefined
      }))
      .sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime());

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
  // MIGRATED: Removed DB guard - now S3-only
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

    // Get assignments for the structure from S3
    const storageClient = createStorageClient();
    const allAssignments = await readAllAssignmentsFromS3(storageClient);
    const assignments = allAssignments
      .filter(a => a.structure_id === structureId)
      .map(a => ({
        ...a,
        assigned_at: new Date(a.assigned_at),
        completed_at: a.completed_at ? new Date(a.completed_at) : undefined,
        expected_completion_date: a.expected_completion_date ? new Date(a.expected_completion_date) : undefined
      }))
      .sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime());

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
  // MIGRATED: Removed DB guard - now S3-only
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

    // Get assignments for the site engineer from S3
    const storageClient = createStorageClient();
    const allAssignments = await readAllAssignmentsFromS3(storageClient);
    const assignments = allAssignments
      .filter(a => a.assigned_site_engineer === siteEngineerId)
      .map(a => ({
        ...a,
        assigned_at: new Date(a.assigned_at),
        completed_at: a.completed_at ? new Date(a.completed_at) : undefined,
        expected_completion_date: a.expected_completion_date ? new Date(a.expected_completion_date) : undefined
      }))
      .sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime());

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
  // MIGRATED: Removed DB guard - now S3-only
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

    // Get all active assignments from S3
    const storageClient = createStorageClient();
    const allAssignments = await readAllAssignmentsFromS3(storageClient);
    const assignments = allAssignments
      .filter(a => a.status === 'active')
      .map(a => ({
        ...a,
        assigned_at: new Date(a.assigned_at),
        completed_at: a.completed_at ? new Date(a.completed_at) : undefined,
        expected_completion_date: a.expected_completion_date ? new Date(a.expected_completion_date) : undefined
      }))
      .sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime());

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
  // MIGRATED: Removed DB guard - now S3-only
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

    // Delete the assignment from S3
    const storageClient = createStorageClient();
    const allAssignments = await readAllAssignmentsFromS3(storageClient);
    const assignmentIndex = allAssignments.findIndex(a => a.assignment_id === assignmentId);
    
    if (assignmentIndex === -1) {
      const response = createResponse(404, {
        success: false,
        message: 'Assignment not found',
        error: 'No assignment exists with the provided ID'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    allAssignments.splice(assignmentIndex, 1);
    await saveAssignmentsToS3(storageClient, allAssignments);

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
  // MIGRATED: Removed DB guard - now S3-only
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

    // Get assignments for the current user from S3
    const storageClient = createStorageClient();
    const allAssignments = await readAllAssignmentsFromS3(storageClient);
    const assignments = allAssignments
      .filter(a => a.assigned_site_engineer === payload.userId)
      .map(a => ({
        ...a,
        assigned_at: new Date(a.assigned_at),
        completed_at: a.completed_at ? new Date(a.completed_at) : undefined,
        expected_completion_date: a.expected_completion_date ? new Date(a.expected_completion_date) : undefined
      }))
      .sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime());

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
