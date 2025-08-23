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

export const createLabTest = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = checkRole(['Admin', 'Lab Engineer'])(event);
    if (authError) {
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
    if (!body.borelog_id || !body.test_type || !body.result) {
      return createResponse(400, {
        success: false,
        message: 'Missing required fields',
        error: 'borelog_id, test_type, and result are required'
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
    const testId = uuidv4();

    // Create lab test record
    const createQuery = `
      INSERT INTO lab_test_results (
        test_id, assignment_id, sample_id, test_type, test_date, 
        results, technician, status, remarks, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      testId,
      body.assignment_id || null,
      body.sample_id || 'Unknown',
      body.test_type,
      body.test_date || new Date().toISOString(),
      JSON.stringify(body.result),
      payload.userId,
      body.status || 'pending',
      body.remarks || null
    ];

    const result = await pool.query(createQuery, values);
    
    logger.info('Lab test created successfully', { testId, borelogId: body.borelog_id });

    return createResponse(201, {
      success: true,
      message: 'Lab test created successfully',
      data: {
        ...result.rows[0],
        borelog: {
          borehole_number: borelog.borehole_number,
          project_name: borelog.project_name,
          chainage: borelog.chainage || 'N/A'
        }
      }
    });
  } catch (error) {
    logger.error('Error creating lab test:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create lab test'
    });
  }
};

export const listLabTests = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = checkRole(['Admin', 'Lab Engineer', 'Project Manager'])(event);
    if (authError) {
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
        ltr.*,
        b.borelog_id,
        p.name as project_name,
        bd.number as borehole_number,
        u.name as technician_name
      FROM lab_test_results ltr
      LEFT JOIN lab_test_assignments lta ON ltr.assignment_id = lta.assignment_id
      LEFT JOIN boreloge b ON lta.borelog_id = b.borelog_id OR ltr.borelog_id = b.borelog_id
      LEFT JOIN projects p ON b.project_id = p.project_id
      LEFT JOIN borelog_details bd ON b.borelog_id = bd.borelog_id
      LEFT JOIN users u ON ltr.technician = u.user_id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramCount = 0;

    // Filter by user role
    if (payload.role === 'Lab Engineer') {
      paramCount++;
      query += ` AND ltr.technician = $${paramCount}`;
      queryParams.push(payload.userId);
    } else if (payload.role === 'Project Manager') {
      // Project managers can see tests for their projects
      paramCount++;
      query += ` AND EXISTS (
        SELECT 1 FROM user_project_assignments upa 
        WHERE upa.project_id = b.project_id 
        AND $${paramCount} = ANY(upa.assignee)
      )`;
      queryParams.push(payload.userId);
    }
    // Admin can see all tests

    query += ` ORDER BY ltr.created_at DESC`;

    const result = await pool.query(query, queryParams);

    const labTests = result.rows.map(row => ({
      id: row.test_id,
      borelog_id: row.borelog_id,
      test_type: row.test_type,
      result: row.results,
      tested_by: row.technician_name,
      test_date: row.test_date,
      remarks: row.remarks,
      status: row.status,
      borelog: {
        borehole_number: row.borehole_number,
        project_name: row.project_name,
        chainage: row.chainage || 'N/A'
      }
    }));

    return createResponse(200, {
      success: true,
      message: 'Lab tests retrieved successfully',
      data: labTests
    });
  } catch (error) {
    logger.error('Error listing lab tests:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve lab tests'
    });
  }
}; 