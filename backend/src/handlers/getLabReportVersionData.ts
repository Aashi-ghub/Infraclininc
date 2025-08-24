import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, logRequest, logResponse } from '../utils/logger';
import { validateToken } from '../utils/validateInput';
import { createResponse } from '../types/common';
import * as db from '../db';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

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
    const versionNo = event.pathParameters?.version_no;
    
    if (!reportId || !versionNo) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing required parameters',
        error: 'report_id and version_no are required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const versionNumber = parseInt(versionNo, 10);
    if (isNaN(versionNumber)) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid version number',
        error: 'version_no must be a valid number'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get specific version data
    const versionQuery = `
      SELECT 
        lrv.*,
        u.name as created_by_name,
        u.email as created_by_email,
        -- Comments from lab_report_comments table
        COALESCE(
          (SELECT comment_text FROM lab_report_comments 
           WHERE report_id = lrv.report_id 
           AND version_no = lrv.version_no 
           AND comment_type = 'submission' 
           ORDER BY commented_at DESC LIMIT 1), 
          ''
        ) as submission_comments,
        COALESCE(
          (SELECT comment_text FROM lab_report_comments 
           WHERE report_id = lrv.report_id 
           AND version_no = lrv.version_no 
           AND comment_type = 'review' 
           ORDER BY commented_at DESC LIMIT 1), 
          ''
        ) as review_comments
      FROM lab_report_versions lrv
      LEFT JOIN users u ON lrv.created_by_user_id = u.user_id
      WHERE lrv.report_id = $1 AND lrv.version_no = $2
    `;

    const versionResult = await db.query(versionQuery, [reportId, versionNumber]);
    
    if (versionResult.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Version not found',
        error: 'Specified version does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const version = versionResult[0];

    // Format the response
    const formattedVersion = {
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
    };

    const response = createResponse(200, {
      success: true,
      message: 'Lab report version data retrieved successfully',
      data: formattedVersion
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error retrieving lab report version data:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve version data'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};
