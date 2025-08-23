import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger } from '../utils/logger';
import { createResponse } from '../types/common';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

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
    const payload = await validateToken(authHeader!);
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
    const borelogResult = await pool.query(borelogQuery, [body.borelog_id]);
    
    if (borelogResult.rows.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: 'Borelog with the specified ID does not exist'
      });
    }

    const borelog = borelogResult.rows[0];
    const requestId = uuidv4();

    // Create lab request record
    const createQuery = `
      INSERT INTO lab_test_assignments (
        assignment_id, borelog_id, sample_id, test_type, priority, 
        due_date, notes, requested_by, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      requestId,
      body.borelog_id,
      body.sample_id,
      body.test_type,
      body.priority || 'Medium',
      body.due_date || null,
      body.notes || null,
      payload.userId,
      'Pending'
    ];

    const result = await pool.query(createQuery, values);
    
    logger.info('Lab request created successfully', { requestId, borelogId: body.borelog_id });

    return createResponse(201, {
      success: true,
      message: 'Lab request created successfully',
      data: {
        id: result.rows[0].assignment_id,
        borelog_id: result.rows[0].borelog_id,
        sample_id: result.rows[0].sample_id,
        test_type: result.rows[0].test_type,
        priority: result.rows[0].priority,
        due_date: result.rows[0].due_date,
        notes: result.rows[0].notes,
        requested_by: payload.name || payload.email,
        requested_date: result.rows[0].created_at,
        status: result.rows[0].status,
        borelog: {
          borehole_number: borelog.borehole_number,
          project_name: borelog.project_name,
          chainage: borelog.chainage || 'N/A'
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
    const payload = await validateToken(authHeader!);
    if (!payload) {
      return createResponse(401, {
        success: false,
        message: 'Unauthorized: Invalid token',
        error: 'Invalid token'
      });
    }

    // Build query based on user role
    let query = `
      SELECT 
        lta.*,
        b.borelog_id,
        p.name as project_name,
        bd.number as borehole_number,
        u.name as requested_by_name
      FROM lab_test_assignments lta
      LEFT JOIN boreloge b ON lta.borelog_id = b.borelog_id
      LEFT JOIN projects p ON b.project_id = p.project_id
      LEFT JOIN borelog_details bd ON b.borelog_id = bd.borelog_id
      LEFT JOIN users u ON lta.requested_by = u.user_id
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
      // Lab engineers can see all pending requests
      query += ` AND lta.status = 'Pending'`;
    }
    // Admin can see all requests

    query += ` ORDER BY lta.created_at DESC`;

    const result = await pool.query(query, queryParams);

    const labRequests = result.rows.map(row => ({
      id: row.assignment_id,
      borelog_id: row.borelog_id,
      sample_id: row.sample_id,
      test_type: row.test_type,
      priority: row.priority,
      due_date: row.due_date,
      notes: row.notes,
      requested_by: row.requested_by_name,
      requested_date: row.created_at,
      status: row.status,
      borelog: {
        borehole_number: row.borehole_number,
        project_name: row.project_name,
        chainage: row.chainage || 'N/A'
      }
    }));

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
    const payload = await validateToken(authHeader!);
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
        b.borelog_id,
        p.name as project_name,
        bd.number as borehole_number,
        u.name as requested_by_name
      FROM lab_test_assignments lta
      LEFT JOIN boreloge b ON lta.borelog_id = b.borelog_id
      LEFT JOIN projects p ON b.project_id = p.project_id
      LEFT JOIN borelog_details bd ON b.borelog_id = bd.borelog_id
      LEFT JOIN users u ON lta.requested_by = u.user_id
      WHERE lta.assignment_id = $1
    `;

    const result = await pool.query(query, [requestId]);
    
    if (result.rows.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Lab request not found',
        error: 'Lab request with the specified ID does not exist'
      });
    }

    const row = result.rows[0];
    const labRequest = {
      id: row.assignment_id,
      borelog_id: row.borelog_id,
      sample_id: row.sample_id,
      test_type: row.test_type,
      priority: row.priority,
      due_date: row.due_date,
      notes: row.notes,
      requested_by: row.requested_by_name,
      requested_date: row.created_at,
      status: row.status,
      borelog: {
        borehole_number: row.borehole_number,
        project_name: row.project_name,
        chainage: row.chainage || 'N/A'
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
    const payload = await validateToken(authHeader!);
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
      updateFields.push(`sample_id = $${paramCount}`);
      values.push(body.sample_id);
    }

    if (body.test_type !== undefined) {
      paramCount++;
      updateFields.push(`test_type = $${paramCount}`);
      values.push(body.test_type);
    }

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

    if (body.status !== undefined) {
      paramCount++;
      updateFields.push(`status = $${paramCount}`);
      values.push(body.status);
    }

    if (updateFields.length === 0) {
      return createResponse(400, {
        success: false,
        message: 'No fields to update',
        error: 'At least one field must be provided for update'
      });
    }

    paramCount++;
    updateFields.push(`updated_at = NOW()`);
    values.push(requestId);

    const updateQuery = `
      UPDATE lab_test_assignments 
      SET ${updateFields.join(', ')}
      WHERE assignment_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);
    
    if (result.rows.length === 0) {
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
      data: result.rows[0]
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
    const payload = await validateToken(authHeader!);
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

    const result = await pool.query(deleteQuery, [requestId]);
    
    if (result.rows.length === 0) {
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
    const payload = await validateToken(authHeader!);
    if (!payload) {
      return createResponse(401, {
        success: false,
        message: 'Unauthorized: Invalid token',
        error: 'Invalid token'
      });
    }

    // Get final borelogs (approved versions from borelog_details table)
    let query = `
      SELECT DISTINCT ON (bd.borelog_id)
        bd.borelog_id,
        bd.number as borehole_number,
        bd.version_no,
        bd.created_at,
        p.name as project_name,
        p.location as project_location,
        ss.type as substructure_name,
        s.type as structure_name,
        u.name as created_by_name
      FROM borelog_details bd
      JOIN boreloge b ON bd.borelog_id = b.borelog_id
      JOIN projects p ON b.project_id = p.project_id
      LEFT JOIN sub_structures ss ON b.substructure_id = ss.substructure_id
      LEFT JOIN structure s ON ss.structure_id = s.structure_id
      LEFT JOIN users u ON bd.created_by_user_id = u.user_id
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

    const result = await pool.query(query, queryParams);

    const finalBorelogs = result.rows.map(row => ({
      borelog_id: row.borelog_id,
      borehole_number: row.borehole_number,
      project_name: row.project_name,
      project_location: row.project_location,
      substructure_name: row.substructure_name,
      structure_name: row.structure_name,
      version_no: row.version_no,
      created_at: row.created_at,
      created_by_name: row.created_by_name
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
