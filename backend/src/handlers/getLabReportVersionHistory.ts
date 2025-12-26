import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, logRequest, logResponse } from '../utils/logger';
import { validateToken } from '../utils/validateInput';
import { createResponse } from '../types/common';
import * as db from '../db';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  // Guard: Check if DB is enabled
  const dbGuard = db.guardDbRoute('getLabReportVersionHistory');
  if (dbGuard) return dbGuard;

  try {
    // Validate authentication
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

    const reportId = event.pathParameters?.report_id;
    if (!reportId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing report_id parameter',
        error: 'report_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Check if user has access to this report
    const accessQuery = `
      SELECT 1 FROM unified_lab_reports 
      WHERE report_id = $1
    `;
    const accessResult = await db.query(accessQuery, [reportId]);
    
    if (accessResult.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Lab report not found',
        error: 'Report with the specified ID does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get version history with all details
    const versionHistoryQuery = `
      SELECT 
        lrv.version_no,
        lrv.created_at,
        lrv.status,
        lrv.remarks,
        lrv.submitted_at,
        lrv.approved_at,
        lrv.rejected_at,
        lrv.returned_at,
        lrv.rejection_reason,
        lrv.review_comments,
        lrv.created_by_user_id,
        u.name as created_by_name,
        u.email as created_by_email,
        -- Version details
        lrv.project_name,
        lrv.borehole_no,
        lrv.client,
        lrv.test_date,
        lrv.tested_by,
        lrv.checked_by,
        lrv.approved_by,
        lrv.test_types,
        lrv.soil_test_data,
        lrv.rock_test_data,
        -- Comments from lab_report_comments table
        COALESCE(
          (SELECT comment_text FROM lab_report_comments 
           WHERE report_id = lrv.report_id 
           AND version_no = lrv.version_no 
           AND comment_type = 'submission' 
           ORDER BY commented_at DESC LIMIT 1), 
          ''
        ) as submission_comments
      FROM lab_report_versions lrv
      LEFT JOIN users u ON lrv.created_by_user_id = u.user_id
      WHERE lrv.report_id = $1
      ORDER BY lrv.version_no DESC
    `;

    const versionHistory = await db.query(versionHistoryQuery, [reportId]);

    // Format the response
    const formattedVersions = versionHistory.map(version => ({
      version_no: version.version_no,
      created_at: version.created_at,
      status: version.status,
      created_by: {
        user_id: version.created_by_user_id,
        name: version.created_by_name,
        email: version.created_by_email
      },
      details: {
        project_name: version.project_name,
        borehole_no: version.borehole_no,
        client: version.client,
        test_date: version.test_date,
        tested_by: version.tested_by,
        checked_by: version.checked_by,
        approved_by: version.approved_by,
        test_types: version.test_types,
        soil_test_data: version.soil_test_data,
        rock_test_data: version.rock_test_data,
        remarks: version.remarks,
        submission_comments: version.submission_comments,
        review_comments: version.review_comments,
        rejection_reason: version.rejection_reason
      },
      timestamps: {
        submitted_at: version.submitted_at,
        approved_at: version.approved_at,
        rejected_at: version.rejected_at,
        returned_at: version.returned_at
      }
    }));

    const response = createResponse(200, {
      success: true,
      message: 'Lab report version history retrieved successfully',
      data: {
        report_id: reportId,
        versions: formattedVersions,
        total_versions: formattedVersions.length
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error retrieving lab report version history:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve version history'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};






