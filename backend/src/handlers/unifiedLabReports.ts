import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger } from '../utils/logger';
import { createResponse } from '../types/common';
import * as db from '../db';

// Type definitions
interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  name?: string;
}

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
      assignment_id,
      test_types,
      soil_test_data,
      rock_test_data,
      status,
      test_types_type: typeof test_types,
      is_test_types_array: Array.isArray(test_types)
    });

    // Handle assignment_id - always try to find a valid assignment
    let validAssignmentId = null;
    
    // First, check if the provided assignment_id is valid (not a dummy UUID)
    if (assignment_id && 
        assignment_id !== '00000000-0000-0000-0000-000000000001' && 
        assignment_id !== '00000000-0000-0000-0000-000000000002') {
      // Check if this is a valid assignment_id
      const assignmentCheck = await db.query(
        'SELECT assignment_id FROM lab_test_assignments WHERE assignment_id = $1',
        [assignment_id]
      );
      
      if (assignmentCheck.length > 0) {
        validAssignmentId = assignment_id;
        logger.info('Found valid assignment_id from provided value:', assignment_id);
      }
    }
    
    // If no valid assignment found from provided assignment_id, try to find by borelog_id
    if (!validAssignmentId) {
      logger.info('Looking for assignment by borelog_id:', borelog_id);
      const borelogAssignment = await db.query(
        'SELECT assignment_id FROM lab_test_assignments WHERE borelog_id = $1 LIMIT 1',
        [borelog_id]
      );
      
      if (borelogAssignment.length > 0) {
        validAssignmentId = (borelogAssignment[0] as any).assignment_id;
        logger.info('Found assignment_id by borelog_id:', validAssignmentId);
      } else {
        logger.info('No assignment found for borelog_id:', borelog_id);
      }
    }

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
      originalAssignmentId: assignment_id,
      validAssignmentId,
      borelog_id,
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
      validAssignmentId, // Use validated assignment_id
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

// Approve unified lab report and create final report
export const approveUnifiedLabReport = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Approval Engineer'])(event);
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
    const { customer_notes } = body;

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

    // First, get the current report
    const reportQuery = 'SELECT * FROM unified_lab_reports WHERE report_id = $1';
    const reportResult = await db.query(reportQuery, [reportId]);

    if (reportResult.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Unified lab report not found'
      });
    }

    const report = reportResult[0] as any;

    // Check if report is in submitted status
    if (report.status !== 'submitted') {
      return createResponse(400, {
        success: false,
        message: 'Only submitted reports can be approved',
        error: 'Invalid report status'
      });
    }

    // Get the latest version number
    const versionQuery = 'SELECT MAX(version_no) as latest_version FROM lab_report_versions WHERE report_id = $1';
    const versionResult = await db.query(versionQuery, [reportId]);
    const latestVersion = (versionResult[0] as any)?.latest_version || 1;

    // Begin transaction
    await db.query('BEGIN');

    try {
      // Update the unified lab report status to approved
      const updateQuery = `
        UPDATE unified_lab_reports 
        SET 
          status = 'approved',
          approved_at = NOW(),
          updated_at = NOW()
        WHERE report_id = $1
        RETURNING *
      `;
      
      await db.query(updateQuery, [reportId]);

      // Create final report entry
      const finalReportQuery = `
        INSERT INTO final_lab_reports (
          original_report_id,
          assignment_id,
          borelog_id,
          sample_id,
          project_name,
          borehole_no,
          client,
          test_date,
          tested_by,
          checked_by,
          approved_by,
          test_types,
          soil_test_data,
          rock_test_data,
          final_version_no,
          approval_date,
          approved_by_user_id,
          customer_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
      `;

      const finalReportValues = [
        reportId,
        report.assignment_id,
        report.borelog_id,
        report.sample_id,
        report.project_name,
        report.borehole_no,
        report.client,
        report.test_date,
        report.tested_by,
        report.checked_by,
        report.approved_by,
        report.test_types,
        report.soil_test_data,
        report.rock_test_data,
        latestVersion,
        new Date().toISOString(),
        payload.userId,
        customer_notes || null
      ];

      const finalReportResult = await db.query(finalReportQuery, finalReportValues);

      // Commit transaction
      await db.query('COMMIT');

      logger.info('Lab report approved and final report created', { 
        reportId, 
        finalReportId: (finalReportResult[0] as any).final_report_id,
        approvedBy: payload.userId
      });

      return createResponse(200, {
        success: true,
        message: 'Unified lab report approved successfully',
        data: {
          report: report,
          final_report: finalReportResult[0]
        }
      });

    } catch (error) {
      // Rollback transaction on error
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    logger.error('Error approving unified lab report:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get final lab reports (customer accessible)
export const getFinalLabReports = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Lab Engineer', 'Approval Engineer', 'Customer'])(event);
    if (authError !== null) {
      return authError;
    }

    const queryParams = event.queryStringParameters || {};
    const { project_name, borehole_no, sample_id, approved_by } = queryParams;

    let query = 'SELECT * FROM final_lab_reports_view WHERE 1=1';
    const values: any[] = [];
    let paramCount = 1;

    if (project_name) {
      query += ` AND project_name ILIKE $${paramCount}`;
      values.push(`%${project_name}%`);
      paramCount++;
    }

    if (borehole_no) {
      query += ` AND borehole_no ILIKE $${paramCount}`;
      values.push(`%${borehole_no}%`);
      paramCount++;
    }

    if (sample_id) {
      query += ` AND sample_id ILIKE $${paramCount}`;
      values.push(`%${sample_id}%`);
      paramCount++;
    }

    if (approved_by) {
      query += ` AND approved_by_name ILIKE $${paramCount}`;
      values.push(`%${approved_by}%`);
      paramCount++;
    }

    query += ' ORDER BY approval_date DESC';

    const result = await db.query(query, values);

    return createResponse(200, {
      success: true,
      message: 'Final lab reports retrieved successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error getting final lab reports:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get final lab report by ID (customer accessible)
export const getFinalLabReport = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Lab Engineer', 'Approval Engineer', 'Customer'])(event);
    if (authError !== null) {
      return authError;
    }

    const finalReportId = event.pathParameters?.finalReportId;
    if (!finalReportId) {
      return createResponse(400, {
        success: false,
        message: 'Final Report ID is required'
      });
    }

    const query = 'SELECT * FROM final_lab_reports_view WHERE final_report_id = $1';
    const result = await db.query(query, [finalReportId]);

    if (result.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Final lab report not found'
      });
    }

    return createResponse(200, {
      success: true,
      message: 'Final lab report retrieved successfully',
      data: result[0]
    });
  } catch (error) {
    logger.error('Error getting final lab report:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
