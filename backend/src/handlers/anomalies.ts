import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger } from '../utils/logger';
import { createResponse } from '../types/common';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export const listAnomalies = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = checkRole(['Admin', 'Project Manager', 'Lab Engineer'])(event);
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
        a.*,
        b.borelog_id,
        p.name as project_name,
        bd.number as borehole_number,
        u.name as flagged_by_name
      FROM anomalies a
      LEFT JOIN boreloge b ON a.borelog_id = b.borelog_id
      LEFT JOIN projects p ON b.project_id = p.project_id
      LEFT JOIN borelog_details bd ON b.borelog_id = bd.borelog_id
      LEFT JOIN users u ON a.flagged_by = u.user_id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramCount = 0;

    // Filter by user role
    if (payload.role === 'Project Manager') {
      // Project managers can see anomalies for their projects
      paramCount++;
      query += ` AND EXISTS (
        SELECT 1 FROM user_project_assignments upa 
        WHERE upa.project_id = b.project_id 
        AND $${paramCount} = ANY(upa.assignee)
      )`;
      queryParams.push(payload.userId);
    } else if (payload.role === 'Lab Engineer') {
      // Lab engineers can see anomalies for tests they're working on
      paramCount++;
      query += ` AND EXISTS (
        SELECT 1 FROM lab_test_results ltr 
        WHERE ltr.borelog_id = b.borelog_id 
        AND ltr.technician = $${paramCount}
      )`;
      queryParams.push(payload.userId);
    }
    // Admin can see all anomalies

    query += ` ORDER BY a.flagged_at DESC`;

    const result = await pool.query(query, queryParams);

    const anomalies = result.rows.map(row => ({
      id: row.anomaly_id,
      reason: row.reason,
      status: row.status,
      flagged_by: row.flagged_by_name,
      flagged_at: row.flagged_at,
      geological_log: {
        id: row.borelog_id,
        project_name: row.project_name,
        borehole_number: row.borehole_number,
        client_name: row.client_name || 'N/A'
      }
    }));

    return createResponse(200, {
      success: true,
      message: 'Anomalies retrieved successfully',
      data: anomalies
    });
  } catch (error) {
    logger.error('Error listing anomalies:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve anomalies'
    });
  }
};

export const createAnomaly = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = checkRole(['Admin', 'Engineer'])(event);
    if (authError) {
      return authError;
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // In a real implementation, you would validate the input and save to database
    const newAnomaly = {
      id: `a-${Date.now()}`,
      ...body,
      status: 'Pending',
      flagged_at: new Date().toISOString(),
      geological_log: {
        id: body.geological_log_id || 'gl-unknown',
        project_name: 'Unknown Project',
        borehole_number: 'Unknown',
        client_name: 'Unknown Client'
      }
    };
    
    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Anomaly created successfully',
        data: newAnomaly,
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error creating anomaly:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Internal server error',
        status: 'error'
      })
    };
  }
};

export const updateAnomaly = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = checkRole(['Admin'])(event);
    if (authError) {
      return authError;
    }

    // Get anomaly ID from path parameters
    const anomalyId = event.pathParameters?.anomaly_id;
    
    if (!anomalyId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Missing anomaly_id parameter',
          status: 'error'
        })
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // In a real implementation, you would validate the input and update in database
    // Here we just return a mock response
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Anomaly updated successfully',
        data: {
          id: anomalyId,
          ...body,
          updated_at: new Date().toISOString()
        },
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error updating anomaly:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Internal server error',
        status: 'error'
      })
    };
  }
}; 