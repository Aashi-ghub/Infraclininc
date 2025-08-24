import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger } from '../utils/logger';
import { createResponse } from '../types/common';
import * as db from '../db';

// Type definitions for database results
interface BorelogResult {
  borelog_id: string;
  project_name: string;
  borehole_number: string;
  chainage_km?: string;
}

interface LabAssignmentResult {
  assignment_id: string;
  borelog_id: string;
  sample_ids: string[];
  assigned_to: string;
  priority: string;
  due_date: string | null;
  assigned_at: string;
  assigned_by: string;
  notes: string | null;
  project_name: string;
  borehole_number: string;
  assigned_by_name: string;
  assigned_lab_engineer_name: string;
}

interface LabRequestDetailResult {
  assignment_id: string;
  borelog_id: string;
  sample_ids: string[];
  assigned_to: string;
  priority: string;
  due_date: string | null;
  assigned_at: string;
  assigned_by: string;
  notes: string | null;
  project_name: string;
  borehole_number: string;
  assigned_by_name: string;
}

interface FinalBorelogResult {
  borelog_id: string;
  borehole_number: string;
  created_at: string;
  project_name: string;
  project_location: string;
  version_no: number;
}

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  name?: string;
}

// Create new lab request
export const createLabRequest = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager'])(event);
    if (authError !== null) {
      return authError;
    }

    // Get user info from token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = await validateToken(authHeader!) as JwtPayload;
    if (!payload) {
      return createResponse(401, {
        success: false,
        message: 'Unauthorized: Invalid token',
        error: 'Invalid token'
      });
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.borelog_id || !body.sample_id || !body.test_type) {
      return createResponse(400, {
        success: false,
        message: 'Missing required fields',
        error: 'borelog_id, sample_id, and test_type are required'
      });
    }

    // Check if borelog exists
    const borelogQuery = `
      SELECT b.*, p.name as project_name, bd.number as borehole_number
      FROM boreloge b 
      JOIN projects p ON b.project_id = p.project_id
      LEFT JOIN borelog_details bd ON b.borelog_id = bd.borelog_id
      WHERE b.borelog_id = $1
    `;
    const borelogResult = await db.query(borelogQuery, [body.borelog_id]) as BorelogResult[];
    
    if (borelogResult.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: 'Borelog with the specified ID does not exist'
      });
    }

    const borelog = borelogResult[0];
    const requestId = uuidv4();

    // Create lab request record
    const createQuery = `
      INSERT INTO lab_test_assignments (
        assignment_id, borelog_id, version_no, sample_ids, assigned_by, 
        assigned_to, due_date, priority, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      requestId,
      body.borelog_id,
      1, // Default version_no
      [body.sample_id], // Convert to array
      payload.userId,
      payload.userId, // For now, assign to the same user
      body.due_date || null,
      body.priority || 'normal',
      body.notes || null
    ];

    const result = await db.query(createQuery, values) as LabAssignmentResult[];
    
    logger.info('Lab request created successfully', { requestId, borelogId: body.borelog_id });

    return createResponse(201, {
      success: true,
      message: 'Lab request created successfully',
      data: {
        id: result[0].assignment_id,
        borelog_id: result[0].borelog_id,
        sample_id: result[0].sample_ids[0], // Get first sample ID from array
        test_type: body.test_type, // Keep the test_type from request
        priority: result[0].priority,
        due_date: result[0].due_date,
        notes: result[0].notes,
        requested_by: payload.name || payload.email,
        requested_date: result[0].assigned_at,
        status: 'assigned', // Default status
        borelog: {
          borehole_number: borelog.borehole_number,
          project_name: borelog.project_name,
          chainage: borelog.chainage_km || 'N/A'
        }
      }
    });
  } catch (error) {
    logger.error('Error creating lab request:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create lab request'
    });
  }
};

// Get all lab requests
export const listLabRequests = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Lab Engineer'])(event);
    if (authError !== null) {
      return authError;
    }

    // Get user info from token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = await validateToken(authHeader!) as JwtPayload;
    if (!payload) {
      return createResponse(401, {
        success: false,
        message: 'Unauthorized: Invalid token',
        error: 'Invalid token'
      });
    }

    // Build query based on user role - simplified to avoid duplicates
    let query = `
      SELECT 
        lta.assignment_id,
        lta.borelog_id,
        lta.sample_ids,
        lta.assigned_to as assigned_lab_engineer,
        lta.priority,
        lta.due_date,
        lta.assigned_at,
        lta.assigned_by,
        lta.notes,
        p.name as project_name,
        (SELECT bd2.number FROM borelog_details bd2 WHERE bd2.borelog_id = lta.borelog_id ORDER BY bd2.version_no DESC LIMIT 1) as borehole_number,
        u.name as assigned_by_name,
        le.name as assigned_lab_engineer_name
      FROM lab_test_assignments lta
      LEFT JOIN boreloge b ON lta.borelog_id = b.borelog_id
      LEFT JOIN projects p ON b.project_id = p.project_id
      LEFT JOIN users u ON lta.assigned_by = u.user_id
      LEFT JOIN users le ON lta.assigned_to = le.user_id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramCount = 0;

    // Filter by user role
    if (payload.role === 'Project Manager') {
      // Project managers can see requests for their projects
      paramCount++;
      query += ` AND EXISTS (
        SELECT 1 FROM user_project_assignments upa 
        WHERE upa.project_id = b.project_id 
        AND $${paramCount} = ANY(upa.assignee)
      )`;
      queryParams.push(payload.userId);
    } else if (payload.role === 'Lab Engineer') {
      // Lab engineers can see all assigned requests
      query += ` AND lta.assigned_to = $${paramCount + 1}`;
      queryParams.push(payload.userId);
    }
    // Admin can see all requests

    query += ` ORDER BY lta.assigned_at DESC`;

    const result = await db.query(query, queryParams) as LabAssignmentResult[];

    // Create separate lab request entries for each sample ID in the array
    const labRequests: any[] = [];
    
    result.forEach((row: LabAssignmentResult) => {
      const sampleIds = row.sample_ids || [];
      
      if (sampleIds.length === 0) {
        // If no sample IDs, create one entry with empty sample ID
        labRequests.push({
          id: `${row.assignment_id}-0`,
          assignment_id: row.assignment_id,
          borelog_id: row.borelog_id,
          sample_id: '',
          test_type: 'Lab Test',
          priority: row.priority,
          due_date: row.due_date,
          notes: row.notes,
          requested_by: row.assigned_by_name,
          requested_date: row.assigned_at,
          status: 'assigned',
          assigned_lab_engineer: row.assigned_lab_engineer_name,
          borelog: {
            borehole_number: row.borehole_number,
            project_name: row.project_name,
            chainage: 'N/A'
          }
        });
      } else {
        // Create separate entries for each sample ID
        sampleIds.forEach((sampleId: string, index: number) => {
          labRequests.push({
            id: `${row.assignment_id}-${index}`,
            assignment_id: row.assignment_id,
            borelog_id: row.borelog_id,
            sample_id: sampleId,
            test_type: 'Lab Test',
            priority: row.priority,
            due_date: row.due_date,
            notes: row.notes,
            requested_by: row.assigned_by_name,
            requested_date: row.assigned_at,
            status: 'assigned',
            assigned_lab_engineer: row.assigned_lab_engineer_name,
            borelog: {
              borehole_number: row.borehole_number,
              project_name: row.project_name,
              chainage: 'N/A'
            }
          });
        });
      }
    });

    return createResponse(200, {
      success: true,
      message: 'Lab requests retrieved successfully',
      data: labRequests
    });
  } catch (error) {
    logger.error('Error listing lab requests:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve lab requests'
    });
  }
};

// Get lab request by ID
export const getLabRequestById = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Lab Engineer'])(event);
    if (authError !== null) {
      return authError;
    }

    // Get user info from token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = await validateToken(authHeader!) as JwtPayload;
    if (!payload) {
      return createResponse(401, {
        success: false,
        message: 'Unauthorized: Invalid token',
        error: 'Invalid token'
      });
    }

    const requestId = event.pathParameters?.id;
    if (!requestId) {
      return createResponse(400, {
        success: false,
        message: 'Missing request ID',
        error: 'Request ID is required'
      });
    }

    const query = `
      SELECT 
        lta.*,
        p.name as project_name,
        bd.number as borehole_number,
        u.name as assigned_by_name
      FROM lab_test_assignments lta
      LEFT JOIN boreloge b ON lta.borelog_id = b.borelog_id
      LEFT JOIN projects p ON b.project_id = p.project_id
      LEFT JOIN borelog_details bd ON lta.borelog_id = bd.borelog_id
      LEFT JOIN users u ON lta.assigned_by = u.user_id
      WHERE lta.assignment_id = $1
    `;

    const result = await db.query(query, [requestId]) as LabRequestDetailResult[];
    
    if (result.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Lab request not found',
        error: 'Lab request with the specified ID does not exist'
      });
    }

    const row = result[0];
    const labRequest = {
      id: row.assignment_id,
      borelog_id: row.borelog_id,
      sample_id: row.sample_ids ? row.sample_ids[0] : '', // Get first sample ID from array
      test_type: 'Lab Test', // Default test type since it's not stored in the table
      priority: row.priority,
      due_date: row.due_date,
      notes: row.notes,
      requested_by: row.assigned_by_name,
      requested_date: row.assigned_at,
      status: 'assigned', // Default status
      borelog: {
        borehole_number: row.borehole_number,
        project_name: row.project_name,
        chainage: 'N/A'
      }
    };

    return createResponse(200, {
      success: true,
      message: 'Lab request retrieved successfully',
      data: labRequest
    });
  } catch (error) {
    logger.error('Error getting lab request:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve lab request'
    });
  }
};

// Update lab request
export const updateLabRequest = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager'])(event);
    if (authError !== null) {
      return authError;
    }

    // Get user info from token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = await validateToken(authHeader!) as JwtPayload;
    if (!payload) {
      return createResponse(401, {
        success: false,
        message: 'Unauthorized: Invalid token',
        error: 'Invalid token'
      });
    }

    const requestId = event.pathParameters?.id;
    if (!requestId) {
      return createResponse(400, {
        success: false,
        message: 'Missing request ID',
        error: 'Request ID is required'
      });
    }

    const body = JSON.parse(event.body || '{}');
    
    // Build update query dynamically
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (body.sample_id !== undefined) {
      paramCount++;
      updateFields.push(`sample_ids = $${paramCount}`);
      values.push([body.sample_id]); // Convert to array
    }

    // Note: test_type is not stored in the lab_test_assignments table
    // It would need to be stored in a separate table or handled differently

    if (body.priority !== undefined) {
      paramCount++;
      updateFields.push(`priority = $${paramCount}`);
      values.push(body.priority);
    }

    if (body.due_date !== undefined) {
      paramCount++;
      updateFields.push(`due_date = $${paramCount}`);
      values.push(body.due_date);
    }

    if (body.notes !== undefined) {
      paramCount++;
      updateFields.push(`notes = $${paramCount}`);
      values.push(body.notes);
    }

    // Note: status is not stored in the lab_test_assignments table
    // It would need to be stored in a separate table or handled differently

    if (updateFields.length === 0) {
      return createResponse(400, {
        success: false,
        message: 'No fields to update',
        error: 'At least one field must be provided for update'
      });
    }

    paramCount++;
    values.push(requestId);

    const updateQuery = `
      UPDATE lab_test_assignments 
      SET ${updateFields.join(', ')}
      WHERE assignment_id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);
    
    if (result.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Lab request not found',
        error: 'Lab request with the specified ID does not exist'
      });
    }

    logger.info('Lab request updated successfully', { requestId });

    return createResponse(200, {
      success: true,
      message: 'Lab request updated successfully',
      data: result[0]
    });
  } catch (error) {
    logger.error('Error updating lab request:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to update lab request'
    });
  }
};

// Delete lab request
export const deleteLabRequest = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin'])(event);
    if (authError !== null) {
      return authError;
    }

    // Get user info from token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = await validateToken(authHeader!) as JwtPayload;
    if (!payload) {
      return createResponse(401, {
        success: false,
        message: 'Unauthorized: Invalid token',
        error: 'Invalid token'
      });
    }

    const requestId = event.pathParameters?.id;
    if (!requestId) {
      return createResponse(400, {
        success: false,
        message: 'Missing request ID',
        error: 'Request ID is required'
      });
    }

    const deleteQuery = `
      DELETE FROM lab_test_assignments 
      WHERE assignment_id = $1
      RETURNING assignment_id
    `;

    const result = await db.query(deleteQuery, [requestId]);
    
    if (result.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Lab request not found',
        error: 'Lab request with the specified ID does not exist'
      });
    }

    logger.info('Lab request deleted successfully', { requestId });

    return createResponse(200, {
      success: true,
      message: 'Lab request deleted successfully',
      data: null
    });
  } catch (error) {
    logger.error('Error deleting lab request:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to delete lab request'
    });
  }
};

// Get final borelogs for lab requests (accessible by Project Managers and Lab Engineers)
export const getFinalBorelogs = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Lab Engineer'])(event);
    if (authError !== null) {
      return authError;
    }

    // Get user info from token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = await validateToken(authHeader!) as JwtPayload;
    if (!payload) {
      return createResponse(401, {
        success: false,
        message: 'Unauthorized: Invalid token',
        error: 'Invalid token'
      });
    }

    // Get final borelogs (only the latest version of each borelog)
    let query = `
      SELECT 
        bd.borelog_id,
        bd.number as borehole_number,
        bd.created_at,
        p.name as project_name,
        p.location as project_location,
        bd.version_no
      FROM borelog_details bd
      INNER JOIN (
        SELECT borelog_id, MAX(version_no) as max_version
        FROM borelog_details
        GROUP BY borelog_id
      ) latest ON bd.borelog_id = latest.borelog_id AND bd.version_no = latest.max_version
      LEFT JOIN boreloge b ON bd.borelog_id = b.borelog_id
      LEFT JOIN projects p ON b.project_id = p.project_id
      WHERE bd.borelog_id IS NOT NULL
    `;

    const queryParams: any[] = [];
    let paramCount = 0;

    // Filter by user role
    if (payload.role === 'Project Manager') {
      // Project managers can see final borelogs for their projects
      paramCount++;
      query += ` AND EXISTS (
        SELECT 1 FROM user_project_assignments upa 
        WHERE upa.project_id = b.project_id 
        AND $${paramCount} = ANY(upa.assignee)
      )`;
      queryParams.push(payload.userId);
    }
    // Admin and Lab Engineer can see all final borelogs

    query += ` ORDER BY bd.borelog_id, bd.version_no DESC`;

    logger.info('Executing getFinalBorelogs query:', { query, queryParams });

    let result;
    try {
      result = await db.query(query, queryParams) as FinalBorelogResult[];
    } catch (dbError) {
      logger.error('Database query error in getFinalBorelogs:', dbError);
      return createResponse(500, {
        success: false,
        message: 'Database query error',
        error: 'Failed to execute database query'
      });
    }

    if (!result) {
      logger.error('Database query returned undefined result');
      return createResponse(500, {
        success: false,
        message: 'Database error',
        error: 'Failed to retrieve data from database'
      });
    }

    const finalBorelogs = result.map((row: FinalBorelogResult) => ({
      borelog_id: row.borelog_id,
      borehole_number: row.borehole_number,
      project_name: row.project_name,
      project_location: row.project_location,
      version_no: row.version_no,
      created_at: row.created_at
    }));

    return createResponse(200, {
      success: true,
      message: 'Final borelogs retrieved successfully',
      data: finalBorelogs
    });
  } catch (error) {
    logger.error('Error getting final borelogs:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve final borelogs'
    });
  }
};
