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
    const { 
      assignment_id,
      borelog_id,
      sample_id, 
      borehole_no, 
      project_name, 
      client,
      test_date,
      tested_by,
      checked_by,
      approved_by,
      test_types, 
      soil_test_data, 
      rock_test_data, 
      status, 
      remarks 
    } = body;

    // Log the received data for debugging
    logger.info('Received unified lab report data:', {
      test_types,
      soil_test_data,
      rock_test_data,
      status,
      test_types_type: typeof test_types,
      is_test_types_array: Array.isArray(test_types)
    });

    // Ensure arrays are properly formatted for JSONB
    // Always ensure we have valid arrays, even if the input is null/undefined
    // Convert to JSON string to ensure proper JSONB format
    const formattedTestTypes = Array.isArray(test_types) ? JSON.stringify(test_types) : '[]';
    const formattedSoilData = Array.isArray(soil_test_data) ? JSON.stringify(soil_test_data) : '[]';
    const formattedRockData = Array.isArray(rock_test_data) ? JSON.stringify(rock_test_data) : '[]';
    
    // Additional validation: ensure status is valid
    const validStatus = status && ['draft', 'submitted', 'approved', 'rejected'].includes(status) ? status : 'draft';

    // Log the formatted data
    logger.info('Formatted data:', {
      formattedTestTypes,
      formattedSoilData,
      formattedRockData,
      status: validStatus
    });

    const query = `
      INSERT INTO unified_lab_reports (
        assignment_id, borelog_id, sample_id, borehole_no, project_name, client,
        test_date, tested_by, checked_by, approved_by, test_types, 
        soil_test_data, rock_test_data, status, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const values = [
      assignment_id || null, // Allow null for drafts
      borelog_id,
      sample_id, 
      borehole_no, 
      project_name, 
      client,
      test_date,
      tested_by,
      checked_by,
      approved_by,
      formattedTestTypes, 
      formattedSoilData, 
      formattedRockData, 
      validStatus, 
      remarks
    ];

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

    // Ensure arrays are properly formatted for JSONB
    // Convert to JSON string to ensure proper JSONB format
    const formattedTestTypes = Array.isArray(test_types) ? JSON.stringify(test_types) : undefined;
    const formattedSoilData = Array.isArray(soil_test_data) ? JSON.stringify(soil_test_data) : undefined;
    const formattedRockData = Array.isArray(rock_test_data) ? JSON.stringify(rock_test_data) : undefined;

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

    const values = [reportId, formattedSoilData, formattedRockData, formattedTestTypes, status, remarks, rejection_reason];

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
