import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

interface UnifiedLabReport {
  report_id?: string;
  assignment_id: string;
  borelog_id: string;
  sample_id: string;
  project_name: string;
  borehole_no: string;
  client: string;
  test_date: string;
  tested_by: string;
  checked_by: string;
  approved_by: string;
  test_types: string[]; // ['Soil', 'Rock']
  soil_test_data: any[];
  rock_test_data: any[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  remarks?: string;
  submitted_at?: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
}

interface CreateUnifiedLabReportRequest {
  assignment_id: string;
  borelog_id: string;
  sample_id: string;
  project_name: string;
  borehole_no: string;
  client: string;
  test_date: string;
  tested_by: string;
  checked_by: string;
  approved_by: string;
  test_types: string[];
  soil_test_data: any[];
  rock_test_data: any[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  remarks?: string;
}

interface UpdateUnifiedLabReportRequest {
  soil_test_data?: any[];
  rock_test_data?: any[];
  test_types?: string[];
  status?: 'draft' | 'submitted' | 'approved' | 'rejected';
  remarks?: string;
  rejection_reason?: string;
}

// Create new unified lab report
export const createUnifiedLabReport = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body: CreateUnifiedLabReportRequest = JSON.parse(event.body || '{}');
    const reportId = uuidv4();

    const query = `
      INSERT INTO unified_lab_reports (
        report_id, assignment_id, borelog_id, sample_id, project_name, borehole_no,
        client, test_date, tested_by, checked_by, approved_by, test_types,
        soil_test_data, rock_test_data, status, remarks, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      reportId,
      body.assignment_id,
      body.borelog_id,
      body.sample_id,
      body.project_name,
      body.borehole_no,
      body.client,
      body.test_date,
      body.tested_by,
      body.checked_by,
      body.approved_by,
      JSON.stringify(body.test_types),
      JSON.stringify(body.soil_test_data),
      JSON.stringify(body.rock_test_data),
      body.status,
      body.remarks || null
    ];

    const result = await pool.query(query, values);

    logger.info('Unified lab report created successfully', { reportId });

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        data: result.rows[0],
        message: 'Unified lab report created successfully'
      })
    };
  } catch (error) {
    logger.error('Error creating unified lab report:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

// Get unified lab report by ID
export const getUnifiedLabReport = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const reportId = event.pathParameters?.reportId;

    if (!reportId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          success: false,
          message: 'Report ID is required'
        })
      };
    }

    const query = 'SELECT * FROM unified_lab_reports WHERE report_id = $1';
    const result = await pool.query(query, [reportId]);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          success: false,
          message: 'Unified lab report not found'
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        data: result.rows[0]
      })
    };
  } catch (error) {
    logger.error('Error getting unified lab report:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

// Update unified lab report
export const updateUnifiedLabReport = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const reportId = event.pathParameters?.reportId;
    const body: UpdateUnifiedLabReportRequest = JSON.parse(event.body || '{}');

    if (!reportId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          success: false,
          message: 'Report ID is required'
        })
      };
    }

    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (body.soil_test_data !== undefined) {
      updateFields.push(`soil_test_data = $${paramCount}`);
      values.push(JSON.stringify(body.soil_test_data));
      paramCount++;
    }

    if (body.rock_test_data !== undefined) {
      updateFields.push(`rock_test_data = $${paramCount}`);
      values.push(JSON.stringify(body.rock_test_data));
      paramCount++;
    }

    if (body.test_types !== undefined) {
      updateFields.push(`test_types = $${paramCount}`);
      values.push(JSON.stringify(body.test_types));
      paramCount++;
    }

    if (body.status !== undefined) {
      updateFields.push(`status = $${paramCount}`);
      values.push(body.status);
      paramCount++;
    }

    if (body.remarks !== undefined) {
      updateFields.push(`remarks = $${paramCount}`);
      values.push(body.remarks);
      paramCount++;
    }

    if (body.rejection_reason !== undefined) {
      updateFields.push(`rejection_reason = $${paramCount}`);
      values.push(body.rejection_reason);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          success: false,
          message: 'No fields to update'
        })
      };
    }

    // Add status-specific timestamps
    if (body.status === 'submitted') {
      updateFields.push(`submitted_at = NOW()`);
    } else if (body.status === 'approved') {
      updateFields.push(`approved_at = NOW()`);
    } else if (body.status === 'rejected') {
      updateFields.push(`rejected_at = NOW()`);
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(reportId);

    const query = `
      UPDATE unified_lab_reports 
      SET ${updateFields.join(', ')}
      WHERE report_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          success: false,
          message: 'Unified lab report not found'
        })
      };
    }

    logger.info('Unified lab report updated successfully', { reportId });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        data: result.rows[0],
        message: 'Unified lab report updated successfully'
      })
    };
  } catch (error) {
    logger.error('Error updating unified lab report:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

// Get all unified lab reports (with optional filters)
export const getUnifiedLabReports = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const queryParams = event.queryStringParameters || {};
    const { status, tested_by, sample_id, borehole_no, project_name } = queryParams;

    let query = 'SELECT * FROM unified_lab_reports WHERE 1=1';
    const values: any[] = [];
    let paramCount = 1;

    if (status) {
      query += ` AND status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    if (tested_by) {
      query += ` AND tested_by = $${paramCount}`;
      values.push(tested_by);
      paramCount++;
    }

    if (sample_id) {
      query += ` AND sample_id = $${paramCount}`;
      values.push(sample_id);
      paramCount++;
    }

    if (borehole_no) {
      query += ` AND borehole_no = $${paramCount}`;
      values.push(borehole_no);
      paramCount++;
    }

    if (project_name) {
      query += ` AND project_name ILIKE $${paramCount}`;
      values.push(`%${project_name}%`);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, values);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        data: result.rows,
        count: result.rows.length
      })
    };
  } catch (error) {
    logger.error('Error getting unified lab reports:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

// Delete unified lab report
export const deleteUnifiedLabReport = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const reportId = event.pathParameters?.reportId;

    if (!reportId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          success: false,
          message: 'Report ID is required'
        })
      };
    }

    const query = 'DELETE FROM unified_lab_reports WHERE report_id = $1 RETURNING *';
    const result = await pool.query(query, [reportId]);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          success: false,
          message: 'Unified lab report not found'
        })
      };
    }

    logger.info('Unified lab report deleted successfully', { reportId });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        message: 'Unified lab report deleted successfully'
      })
    };
  } catch (error) {
    logger.error('Error deleting unified lab report:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
