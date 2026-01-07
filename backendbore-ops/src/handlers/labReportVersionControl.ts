import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { logger, logRequest, logResponse } from '../utils/logger';
import { validateToken } from '../utils/validateInput';
import { createResponse } from '../types/common';
import * as db from '../db';
import { guardDbRoute } from '../db';

// Save draft version of lab report
export const saveLabReportDraft = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('saveLabReportDraft');
  if (dbGuard) return dbGuard;

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
    const { report_id, assignment_id, borelog_id, sample_id, project_name, borehole_no, client, test_date, tested_by, checked_by, approved_by, test_types, soil_test_data, rock_test_data, remarks,
      location, section_name, chainage_km, coordinates_e, coordinates_n } = body;

    // Log the received data for debugging
    logger.info('Received saveLabReportDraft request:', {
      assignment_id,
      borelog_id,
      sample_id,
      project_name,
      borehole_no,
      test_date,
      tested_by,
      checked_by,
      approved_by,
      test_types,
      report_id
    });

    // For drafts, all fields are optional - only validate assignment_id if provided
    if (assignment_id) {
      // Check if user has access to this assignment
      const assignmentQuery = `
        SELECT 1 FROM lab_test_assignments 
        WHERE assignment_id = $1 AND assigned_to = $2
      `;
      const assignmentResult = await db.query(assignmentQuery, [assignment_id, payload.userId]);
      
      if (assignmentResult.length === 0 && payload.role !== 'Admin') {
        const response = createResponse(403, {
          success: false,
          message: 'Access denied: User not assigned to this lab test',
          error: 'Insufficient permissions'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
    }



    // Get or create report_id
    let finalReportId = report_id;
    if (!finalReportId) {
      finalReportId = uuidv4();
      
      // Create minimal record in unified_lab_reports (will be updated by triggers)
      const createReportQuery = `
        INSERT INTO unified_lab_reports (
          report_id, assignment_id, borelog_id, sample_id, project_name, borehole_no, 
          client, test_date, tested_by, checked_by, approved_by, test_types, 
          soil_test_data, rock_test_data, status, remarks, created_by_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (report_id) DO NOTHING
      `;
      
      await db.query(createReportQuery, [
        finalReportId, assignment_id || null, borelog_id || null, sample_id || null, project_name || null, borehole_no || null,
        client || null, test_date || null, tested_by || null, checked_by || null, approved_by || null, JSON.stringify(test_types || []),
        JSON.stringify(soil_test_data || []), JSON.stringify(rock_test_data || []), 'draft', remarks || null, payload.userId
      ]);
    }

    // Get next version number
    const versionQuery = `SELECT get_next_lab_report_version($1) as next_version`;
    const versionResult = await db.query(versionQuery, [finalReportId]);
    const nextVersion = (versionResult[0] as any).next_version;

    // Create new version
    const createVersionQuery = `
      INSERT INTO lab_report_versions (
        report_id, version_no, assignment_id, borelog_id, sample_id, project_name, borehole_no,
        client, test_date, tested_by, checked_by, approved_by, test_types, 
        soil_test_data, rock_test_data, status, remarks, created_by_user_id,
        location, section_name, chainage_km, coordinates_e, coordinates_n
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
    `;

    await db.query(createVersionQuery, [
      finalReportId, nextVersion, assignment_id || null, borelog_id || null, sample_id || null, project_name || null, borehole_no || null,
      client || null, test_date || null, tested_by || null, checked_by || null, approved_by || null, JSON.stringify(test_types || []),
      JSON.stringify(soil_test_data || []), JSON.stringify(rock_test_data || []), 'draft', remarks || null, payload.userId,
      location || null, section_name || null, chainage_km || null, coordinates_e || null, coordinates_n || null
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
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('submitLabReportForReview');
  if (dbGuard) return dbGuard;

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
    const accessResult = await db.query(accessQuery, [report_id, version_no]);
    
    if (accessResult.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Lab report version not found',
        error: 'Report version does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const reportVersion = accessResult[0] as any;
    
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
    await db.query(updateQuery, [report_id, version_no]);

    // Add submission comment if provided
    if (submission_comments && submission_comments.trim()) {
      const commentQuery = `
        INSERT INTO lab_report_review_comments (
          report_id, version_no, comment_type, comment_text, commented_by
        ) VALUES ($1, $2, $3, $4, $5)
      `;
      await db.query(commentQuery, [
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
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('reviewLabReport');
  if (dbGuard) return dbGuard;

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
    const reportResult = await db.query(reportQuery, [reportId, version_no]);
    
    if (reportResult.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Lab report version not found',
        error: 'Report version does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const reportVersion = reportResult[0] as any;

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
      default:
        throw new Error('Invalid action');
    }

    const updateQuery = `
      UPDATE lab_report_versions 
      SET ${updateFields}
      WHERE report_id = $2 AND version_no = $3
    `;
    await db.query(updateQuery, updateParams);

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
      await db.query(commentQuery, [
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
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('getLabReportVersionHistory');
  if (dbGuard) return dbGuard;

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });
  
  // Add debug logging
  logger.info('getLabReportVersionHistory called with event:', {
    path: event.path,
    pathParameters: event.pathParameters,
    headers: event.headers
  });

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

    // Simplified access control - allow access if user has appropriate role
    if (!['Admin', 'Lab Engineer', 'Approval Engineer'].includes(payload.role)) {
      const response = createResponse(403, {
        success: false,
        message: 'Access denied: Insufficient permissions',
        error: 'User role not authorized'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get version history - simplified query without complex aggregation
    const historyQuery = `
      SELECT 
        lrv.*,
        u.name as created_by_name,
        u2.name as returned_by_name
      FROM lab_report_versions lrv
      LEFT JOIN users u ON lrv.created_by_user_id = u.user_id
      LEFT JOIN users u2 ON lrv.returned_by = u2.user_id
      WHERE lrv.report_id = $1
      ORDER BY lrv.version_no DESC
    `;
    
    const historyResult = await db.query(historyQuery, [reportId]);
    
    // Log the result for debugging
    logger.info('Version history query result:', {
      reportId,
      resultCount: historyResult.length,
      result: historyResult
    });

    const response = createResponse(200, {
      success: true,
      message: 'Lab report version history retrieved successfully',
      data: {
        report_id: reportId,
        versions: historyResult
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
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('getLabReportVersion');
  if (dbGuard) return dbGuard;

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

    // Simplified access control - allow access if user has appropriate role
    if (!['Admin', 'Lab Engineer', 'Approval Engineer'].includes(payload.role)) {
      const response = createResponse(403, {
        success: false,
        message: 'Access denied: Insufficient permissions',
        error: 'User role not authorized'
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
    
    const versionResult = await db.query(versionQuery, [reportId, versionNo]);

    if (versionResult.length === 0) {
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
      data: versionResult[0]
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
