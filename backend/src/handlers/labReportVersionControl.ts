import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { validateToken } from '../utils/auth';
import { createResponse, logRequest, logResponse } from '../utils/response';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Save draft version of lab report
export const saveLabReportDraft = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

    const body = JSON.parse(event.body || '{}');
    const { report_id, assignment_id, borelog_id, sample_id, project_name, borehole_no, client, test_date, tested_by, checked_by, approved_by, test_types, soil_test_data, rock_test_data, remarks } = body;

    // Validate required fields
    if (!assignment_id || !borelog_id || !sample_id || !project_name || !borehole_no || !test_date || !tested_by || !checked_by || !approved_by || !test_types) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing required fields',
        error: 'All required fields must be provided'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Check if user has access to this assignment
    const assignmentQuery = `
      SELECT 1 FROM lab_test_assignments 
      WHERE assignment_id = $1 AND assigned_to = $2
    `;
    const assignmentResult = await pool.query(assignmentQuery, [assignment_id, payload.userId]);
    
    if (assignmentResult.rows.length === 0 && payload.role !== 'Admin') {
      const response = createResponse(403, {
        success: false,
        message: 'Access denied: User not assigned to this lab test',
        error: 'Insufficient permissions'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get or create report_id
    let finalReportId = report_id;
    if (!finalReportId) {
      finalReportId = uuidv4();
      
      // Create main report record
      const createReportQuery = `
        INSERT INTO unified_lab_reports (
          report_id, assignment_id, borelog_id, sample_id, project_name, borehole_no, 
          client, test_date, tested_by, checked_by, approved_by, test_types, 
          soil_test_data, rock_test_data, status, remarks, created_by_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `;
      
      await pool.query(createReportQuery, [
        finalReportId, assignment_id, borelog_id, sample_id, project_name, borehole_no,
        client, test_date, tested_by, checked_by, approved_by, JSON.stringify(test_types),
        JSON.stringify(soil_test_data || []), JSON.stringify(rock_test_data || []), 'draft', remarks, payload.userId
      ]);
    }

    // Get next version number
    const versionQuery = `SELECT get_next_lab_report_version($1) as next_version`;
    const versionResult = await pool.query(versionQuery, [finalReportId]);
    const nextVersion = versionResult.rows[0].next_version;

    // Create new version
    const createVersionQuery = `
      INSERT INTO lab_report_versions (
        report_id, version_no, assignment_id, borelog_id, sample_id, project_name, borehole_no,
        client, test_date, tested_by, checked_by, approved_by, test_types, 
        soil_test_data, rock_test_data, status, remarks, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    `;

    await pool.query(createVersionQuery, [
      finalReportId, nextVersion, assignment_id, borelog_id, sample_id, project_name, borehole_no,
      client, test_date, tested_by, checked_by, approved_by, JSON.stringify(test_types),
      JSON.stringify(soil_test_data || []), JSON.stringify(rock_test_data || []), 'draft', remarks, payload.userId
    ]);

    logger.info(`Lab report draft saved by user ${payload.userId}`, {
      reportId: finalReportId,
      versionNo: nextVersion,
      assignmentId: assignment_id
    });

    const response = createResponse(200, {
      success: true,
      message: 'Lab report draft saved successfully',
      data: {
        report_id: finalReportId,
        version_no: nextVersion,
        status: 'draft',
        created_by: payload.userId,
        created_at: new Date().toISOString()
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error saving lab report draft:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to save lab report draft'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Submit lab report for review
export const submitLabReportForReview = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

    const body = JSON.parse(event.body || '{}');
    const { report_id, version_no, submission_comments } = body;

    if (!report_id || !version_no) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing required fields',
        error: 'report_id and version_no are required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Check if user has access to this report
    const accessQuery = `
      SELECT lrv.*, lta.assigned_to 
      FROM lab_report_versions lrv
      JOIN lab_test_assignments lta ON lrv.assignment_id = lta.assignment_id
      WHERE lrv.report_id = $1 AND lrv.version_no = $2
    `;
    const accessResult = await pool.query(accessQuery, [report_id, version_no]);
    
    if (accessResult.rows.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Lab report version not found',
        error: 'Report version does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const reportVersion = accessResult.rows[0];
    
    if (reportVersion.assigned_to !== payload.userId && payload.role !== 'Admin') {
      const response = createResponse(403, {
        success: false,
        message: 'Access denied: User not assigned to this lab test',
        error: 'Insufficient permissions'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Update version status to submitted
    const updateQuery = `
      UPDATE lab_report_versions 
      SET status = 'submitted', 
          submitted_at = NOW()
      WHERE report_id = $1 AND version_no = $2
    `;
    await pool.query(updateQuery, [report_id, version_no]);

    // Add submission comment if provided
    if (submission_comments && submission_comments.trim()) {
      const commentQuery = `
        INSERT INTO lab_report_review_comments (
          report_id, version_no, comment_type, comment_text, commented_by
        ) VALUES ($1, $2, $3, $4, $5)
      `;
      await pool.query(commentQuery, [
        report_id, 
        version_no, 
        'approval_comment', 
        submission_comments, 
        payload.userId
      ]);
    }

    logger.info(`Lab report submitted for review by user ${payload.userId}`, {
      reportId: report_id,
      versionNo: version_no,
      submittedBy: payload.userId
    });

    const response = createResponse(200, {
      success: true,
      message: 'Lab report submitted for review successfully',
      data: {
        report_id,
        version_no,
        status: 'submitted',
        submitted_by: payload.userId,
        submitted_at: new Date().toISOString()
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error submitting lab report for review:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to submit lab report for review'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Review lab report (approve/reject/return for revision)
export const reviewLabReport = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has Approval Engineer or Admin role
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
    const body = JSON.parse(event.body || '{}');
    const { action, version_no, review_comments } = body;

    if (!reportId || !version_no || !action) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing required fields',
        error: 'report_id, version_no, and action are required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    if (!['approve', 'reject', 'return_for_revision'].includes(action)) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid action',
        error: 'Action must be approve, reject, or return_for_revision'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Check if report version exists
    const reportQuery = `
      SELECT * FROM lab_report_versions 
      WHERE report_id = $1 AND version_no = $2
    `;
    const reportResult = await pool.query(reportQuery, [reportId, version_no]);
    
    if (reportResult.rows.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Lab report version not found',
        error: 'Report version does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const reportVersion = reportResult.rows[0];

    // Update version status based on action
    let updateFields: string;
    let updateParams: any[];

    switch (action) {
      case 'approve':
        updateFields = `
          status = $1, 
          approved_at = NOW(),
          review_comments = $4
        `;
        updateParams = ['approved', reportId, version_no, review_comments || null];
        break;
      case 'reject':
        updateFields = `
          status = $1, 
          rejected_at = NOW(),
          rejection_reason = $4
        `;
        updateParams = ['rejected', reportId, version_no, review_comments || null];
        break;
      case 'return_for_revision':
        updateFields = `
          status = $1, 
          returned_at = NOW(),
          returned_by = $4,
          review_comments = $5
        `;
        updateParams = ['returned_for_revision', reportId, version_no, payload.userId, review_comments || null];
        break;
    }

    const updateQuery = `
      UPDATE lab_report_versions 
      SET ${updateFields}
      WHERE report_id = $2 AND version_no = $3
    `;
    await pool.query(updateQuery, updateParams);

    // Add review comment
    if (review_comments && review_comments.trim()) {
      const commentType = action === 'approve' ? 'approval_comment' : 
                         action === 'reject' ? 'rejection_reason' : 
                         'correction_required';
      
      const commentQuery = `
        INSERT INTO lab_report_review_comments (
          report_id, version_no, comment_type, comment_text, commented_by
        ) VALUES ($1, $2, $3, $4, $5)
      `;
      await pool.query(commentQuery, [
        reportId, 
        version_no, 
        commentType, 
        review_comments, 
        payload.userId
      ]);
    }

    logger.info(`Lab report ${action} by user ${payload.userId}`, {
      reportId,
      versionNo: version_no,
      reviewedBy: payload.userId,
      action
    });

    const response = createResponse(200, {
      success: true,
      message: `Lab report ${action} successfully`,
      data: {
        report_id: reportId,
        version_no,
        status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'returned_for_revision',
        reviewed_by: payload.userId,
        reviewed_at: new Date().toISOString(),
        action
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error reviewing lab report:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to review lab report'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Get lab report version history
export const getLabReportVersionHistory = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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
      SELECT 1 FROM lab_report_versions lrv
      JOIN lab_test_assignments lta ON lrv.assignment_id = lta.assignment_id
      WHERE lrv.report_id = $1 AND (lta.assigned_to = $2 OR $3 = 'Admin')
    `;
    const accessResult = await pool.query(accessQuery, [reportId, payload.userId, payload.role]);
    
    if (accessResult.rows.length === 0) {
      const response = createResponse(403, {
        success: false,
        message: 'Access denied: User not assigned to this lab test',
        error: 'Insufficient permissions'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get version history with comments
    const historyQuery = `
      SELECT 
        lrv.*,
        u.name as created_by_name,
        u2.name as returned_by_name,
        array_agg(
          json_build_object(
            'comment_id', lrc.comment_id,
            'comment_type', lrc.comment_type,
            'comment_text', lrc.comment_text,
            'commented_by', lrc.commented_by,
            'commented_at', lrc.commented_at
          )
        ) FILTER (WHERE lrc.comment_id IS NOT NULL) as comments
      FROM lab_report_versions lrv
      LEFT JOIN users u ON lrv.created_by_user_id = u.user_id
      LEFT JOIN users u2 ON lrv.returned_by = u2.user_id
      LEFT JOIN lab_report_review_comments lrc ON lrv.report_id = lrc.report_id AND lrv.version_no = lrc.version_no
      WHERE lrv.report_id = $1
      GROUP BY lrv.report_id, lrv.version_no, u.name, u2.name
      ORDER BY lrv.version_no DESC
    `;
    
    const historyResult = await pool.query(historyQuery, [reportId]);

    const response = createResponse(200, {
      success: true,
      message: 'Lab report version history retrieved successfully',
      data: {
        report_id: reportId,
        versions: historyResult.rows
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error getting lab report version history:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to get lab report version history'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Get specific lab report version
export const getLabReportVersion = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

    // Check if user has access to this report
    const accessQuery = `
      SELECT 1 FROM lab_report_versions lrv
      JOIN lab_test_assignments lta ON lrv.assignment_id = lta.assignment_id
      WHERE lrv.report_id = $1 AND lrv.version_no = $2 AND (lta.assigned_to = $3 OR $4 = 'Admin')
    `;
    const accessResult = await pool.query(accessQuery, [reportId, versionNo, payload.userId, payload.role]);
    
    if (accessResult.rows.length === 0) {
      const response = createResponse(403, {
        success: false,
        message: 'Access denied: User not assigned to this lab test',
        error: 'Insufficient permissions'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get specific version with comments
    const versionQuery = `
      SELECT 
        lrv.*,
        u.name as created_by_name,
        u2.name as returned_by_name,
        array_agg(
          json_build_object(
            'comment_id', lrc.comment_id,
            'comment_type', lrc.comment_type,
            'comment_text', lrc.comment_text,
            'commented_by', lrc.commented_by,
            'commented_at', lrc.commented_at
          )
        ) FILTER (WHERE lrc.comment_id IS NOT NULL) as comments
      FROM lab_report_versions lrv
      LEFT JOIN users u ON lrv.created_by_user_id = u.user_id
      LEFT JOIN users u2 ON lrv.returned_by = u2.user_id
      LEFT JOIN lab_report_review_comments lrc ON lrv.report_id = lrc.report_id AND lrv.version_no = lrc.version_no
      WHERE lrv.report_id = $1 AND lrv.version_no = $2
      GROUP BY lrv.report_id, lrv.version_no, u.name, u2.name
    `;
    
    const versionResult = await pool.query(versionQuery, [reportId, versionNo]);

    if (versionResult.rows.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Lab report version not found',
        error: 'Version does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const response = createResponse(200, {
      success: true,
      message: 'Lab report version retrieved successfully',
      data: versionResult.rows[0]
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error getting lab report version:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to get lab report version'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};
