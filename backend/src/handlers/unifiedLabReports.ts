import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole } from '../utils/validateInput';
import { logger } from '../utils/logger';
import { createResponse } from '../types/common';
import * as db from '../db';

// Get all unified lab reports (with optional filters)
export const getUnifiedLabReports = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Lab Engineer', 'Approval Engineer'])(event);
    if (authError !== null) {
      return authError;
    }

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

    const result = await db.query(query, values);

    return createResponse(200, {
      success: true,
      message: 'Unified lab reports retrieved successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error getting unified lab reports:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get unified lab report by ID
export const getUnifiedLabReport = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Lab Engineer', 'Approval Engineer'])(event);
    if (authError !== null) {
      return authError;
    }

    const reportId = event.pathParameters?.reportId;
    if (!reportId) {
      return createResponse(400, {
        success: false,
        message: 'Report ID is required'
      });
    }

    const query = 'SELECT * FROM unified_lab_reports WHERE report_id = $1';
    const result = await db.query(query, [reportId]);

    if (result.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Unified lab report not found'
      });
    }

    return createResponse(200, {
      success: true,
      message: 'Unified lab report retrieved successfully',
      data: result[0]
    });
  } catch (error) {
    logger.error('Error getting unified lab report:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Create unified lab report
export const createUnifiedLabReport = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Lab Engineer'])(event);
    if (authError !== null) {
      return authError;
    }

    const body = JSON.parse(event.body || '{}');
    const { sample_id, borehole_no, project_name, test_types, soil_test_data, rock_test_data, tested_by, status, remarks } = body;

    const query = `
      INSERT INTO unified_lab_reports (
        sample_id, borehole_no, project_name, test_types, 
        soil_test_data, rock_test_data, tested_by, status, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [sample_id, borehole_no, project_name, test_types, soil_test_data, rock_test_data, tested_by, status || 'draft', remarks];

    const result = await db.query(query, values);

    return createResponse(201, {
      success: true,
      message: 'Unified lab report created successfully',
      data: result[0]
    });
  } catch (error) {
    logger.error('Error creating unified lab report:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update unified lab report
export const updateUnifiedLabReport = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Lab Engineer'])(event);
    if (authError !== null) {
      return authError;
    }

    const reportId = event.pathParameters?.reportId;
    if (!reportId) {
      return createResponse(400, {
        success: false,
        message: 'Report ID is required'
      });
    }

    const body = JSON.parse(event.body || '{}');
    const { soil_test_data, rock_test_data, test_types, status, remarks, rejection_reason } = body;

    const query = `
      UPDATE unified_lab_reports 
      SET 
        soil_test_data = COALESCE($2, soil_test_data),
        rock_test_data = COALESCE($3, rock_test_data),
        test_types = COALESCE($4, test_types),
        status = COALESCE($5, status),
        remarks = COALESCE($6, remarks),
        rejection_reason = COALESCE($7, rejection_reason),
        updated_at = NOW()
      WHERE report_id = $1
      RETURNING *
    `;

    const values = [reportId, soil_test_data, rock_test_data, test_types, status, remarks, rejection_reason];

    const result = await db.query(query, values);

    if (result.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Unified lab report not found'
      });
    }

    return createResponse(200, {
      success: true,
      message: 'Unified lab report updated successfully',
      data: result[0]
    });
  } catch (error) {
    logger.error('Error updating unified lab report:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete unified lab report
export const deleteUnifiedLabReport = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin'])(event);
    if (authError !== null) {
      return authError;
    }

    const reportId = event.pathParameters?.reportId;
    if (!reportId) {
      return createResponse(400, {
        success: false,
        message: 'Report ID is required'
      });
    }

    const query = 'DELETE FROM unified_lab_reports WHERE report_id = $1 RETURNING *';
    const result = await db.query(query, [reportId]);

    if (result.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Unified lab report not found'
      });
    }

    logger.info('Unified lab report deleted successfully', { reportId });

    return createResponse(200, {
      success: true,
      message: 'Unified lab report deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting unified lab report:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
