import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

interface LabTestResult {
  test_id?: string;
  assignment_id: string;
  sample_id: string;
  test_type: string;
  test_date: string;
  results: any; // JSONB data from form
  technician: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  remarks?: string;
}

interface CreateLabTestResultRequest {
  assignment_id: string;
  sample_id: string;
  test_type: string;
  test_date: string;
  results: any;
  technician: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  remarks?: string;
}

interface UpdateLabTestResultRequest {
  test_id: string;
  results?: any;
  status?: 'draft' | 'submitted' | 'approved' | 'rejected';
  remarks?: string;
}

// Create new lab test result
export const createLabTestResult = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body: CreateLabTestResultRequest = JSON.parse(event.body || '{}');
    const testId = uuidv4();

    const query = `
      INSERT INTO lab_test_results (
        test_id, assignment_id, sample_id, test_type, test_date, 
        results, technician, status, remarks, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      testId,
      body.assignment_id,
      body.sample_id,
      body.test_type,
      body.test_date,
      JSON.stringify(body.results),
      body.technician,
      body.status,
      body.remarks || null
    ];

    const result = await pool.query(query, values);

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
        message: 'Lab test result created successfully'
      })
    };
  } catch (error) {
    console.error('Error creating lab test result:', error);
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

// Get lab test result by ID
export const getLabTestResult = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const testId = event.pathParameters?.testId;

    if (!testId) {
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
          message: 'Test ID is required'
        })
      };
    }

    const query = 'SELECT * FROM lab_test_results WHERE test_id = $1';
    const result = await pool.query(query, [testId]);

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
          message: 'Lab test result not found'
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
    console.error('Error getting lab test result:', error);
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

// Update lab test result
export const updateLabTestResult = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const testId = event.pathParameters?.testId;
    const body: UpdateLabTestResultRequest = JSON.parse(event.body || '{}');

    if (!testId) {
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
          message: 'Test ID is required'
        })
      };
    }

    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (body.results !== undefined) {
      updateFields.push(`results = $${paramCount}`);
      values.push(JSON.stringify(body.results));
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

    updateFields.push(`updated_at = NOW()`);
    values.push(testId);

    const query = `
      UPDATE lab_test_results 
      SET ${updateFields.join(', ')}
      WHERE test_id = $${paramCount}
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
          message: 'Lab test result not found'
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
        data: result.rows[0],
        message: 'Lab test result updated successfully'
      })
    };
  } catch (error) {
    console.error('Error updating lab test result:', error);
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

// Get all lab test results (with optional filters)
export const getLabTestResults = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const queryParams = event.queryStringParameters || {};
    const { status, technician, sample_id, test_type } = queryParams;

    let query = 'SELECT * FROM lab_test_results WHERE 1=1';
    const values: any[] = [];
    let paramCount = 1;

    if (status) {
      query += ` AND status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    if (technician) {
      query += ` AND technician = $${paramCount}`;
      values.push(technician);
      paramCount++;
    }

    if (sample_id) {
      query += ` AND sample_id = $${paramCount}`;
      values.push(sample_id);
      paramCount++;
    }

    if (test_type) {
      query += ` AND test_type = $${paramCount}`;
      values.push(test_type);
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
    console.error('Error getting lab test results:', error);
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

// Delete lab test result
export const deleteLabTestResult = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const testId = event.pathParameters?.testId;

    if (!testId) {
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
          message: 'Test ID is required'
        })
      };
    }

    const query = 'DELETE FROM lab_test_results WHERE test_id = $1 RETURNING *';
    const result = await pool.query(query, [testId]);

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
          message: 'Lab test result not found'
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
        message: 'Lab test result deleted successfully'
      })
    };
  } catch (error) {
    console.error('Error deleting lab test result:', error);
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
