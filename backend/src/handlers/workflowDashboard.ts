import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import * as db from '../db';

// Get pending reviews (for Approval Engineers and Admins)
export const getPendingReviews = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has Approval Engineer or Admin role
    const authError = await checkRole(['Approval Engineer', 'Admin'])(event);
    if (authError !== null) {
      return authError;
    }

    // Get user info from token
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

    // Get pending reviews based on user role
    let pendingReviewsQuery: string;
    let queryParams: any[] = [];

    if (payload.role === 'Admin') {
      // Admin can see all pending reviews
      pendingReviewsQuery = `
        SELECT 
          bv.borelog_id,
          bv.version_no,
          bv.status,
          bv.submitted_by,
          bv.submitted_at,
          bv.submission_comments,
          b.project_id,
          b.substructure_id,
          b.type as borelog_type,
          p.name as project_name,
          ss.type as substructure_name,
          u.name as submitted_by_name
        FROM borelog_versions bv
        JOIN boreloge b ON bv.borelog_id = b.borelog_id
        JOIN projects p ON b.project_id = p.project_id
        LEFT JOIN sub_structures ss ON b.substructure_id = ss.substructure_id
        LEFT JOIN users u ON bv.submitted_by = u.user_id
        WHERE bv.status = 'submitted'
        ORDER BY bv.submitted_at DESC
      `;
    } else {
      // Approval Engineers can only see reviews for projects they're assigned to
      pendingReviewsQuery = `
        SELECT 
          bv.borelog_id,
          bv.version_no,
          bv.status,
          bv.submitted_by,
          bv.submitted_at,
          bv.submission_comments,
          b.project_id,
          b.substructure_id,
          b.type as borelog_type,
          p.name as project_name,
          ss.type as substructure_name,
          u.name as submitted_by_name
        FROM borelog_versions bv
        JOIN boreloge b ON bv.borelog_id = b.borelog_id
        JOIN projects p ON b.project_id = p.project_id
        LEFT JOIN sub_structures ss ON b.substructure_id = ss.substructure_id
        LEFT JOIN users u ON bv.submitted_by = u.user_id
        JOIN user_project_assignments upa ON p.project_id = upa.project_id
        WHERE bv.status = 'submitted' AND $1 = ANY(upa.assignee)
        ORDER BY bv.submitted_at DESC
      `;
      queryParams = [payload.userId];
    }

    const pendingReviews = await db.query(pendingReviewsQuery, queryParams);

    const response = createResponse(200, {
      success: true,
      message: 'Pending reviews retrieved successfully',
      data: pendingReviews
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error getting pending reviews:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to get pending reviews'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Get lab assignments (for Lab Engineers)
export const getLabAssignments = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has Lab Engineer role
    const authError = await checkRole(['Lab Engineer', 'Admin'])(event);
    if (authError !== null) {
      return authError;
    }

    // Get user info from token
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

         // Query lab assignments from the database
     const labAssignmentsQuery = `
       SELECT 
         la.assignment_id as id,
         la.borelog_id,
         la.sample_ids,
         la.assigned_at,
         la.due_date,
         la.priority,
         la.notes,
         p.name as project_name,
         COALESCE(bd.number, gl.borehole_number) as borehole_number
       FROM lab_test_assignments la
       JOIN boreloge b ON la.borelog_id = b.borelog_id
       JOIN projects p ON b.project_id = p.project_id
       LEFT JOIN borelog_details bd ON b.borelog_id = bd.borelog_id
       LEFT JOIN geological_log gl ON b.borelog_id = gl.borelog_id
       WHERE la.assigned_to = $1
       ORDER BY la.assigned_at DESC
     `;
     
     const labAssignments = await db.query(labAssignmentsQuery, [payload.userId]);

    const response = createResponse(200, {
      success: true,
      message: 'Lab assignments retrieved successfully',
      data: labAssignments
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error getting lab assignments:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to get lab assignments'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Get workflow statistics (for Project Managers and Admins)
export const getWorkflowStatistics = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has Project Manager or Admin role
    const authError = await checkRole(['Project Manager', 'Admin'])(event);
    if (authError !== null) {
      return authError;
    }

    // Get user info from token
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

    // Get workflow statistics based on user role
    let statisticsQuery: string;
    let queryParams: any[] = [];

    if (payload.role === 'Admin') {
      // Admin can see statistics for all projects
      statisticsQuery = `
        SELECT 
          p.project_id,
          p.name as project_name,
          COUNT(b.borelog_id) as total_borelogs,
          COUNT(CASE WHEN bv.status = 'draft' THEN 1 END) as draft_count,
          COUNT(CASE WHEN bv.status = 'submitted' THEN 1 END) as submitted_count,
          COUNT(CASE WHEN bv.status = 'approved' THEN 1 END) as approved_count,
          COUNT(CASE WHEN bv.status = 'rejected' THEN 1 END) as rejected_count,
          COUNT(CASE WHEN bv.status = 'returned_for_revision' THEN 1 END) as returned_count
        FROM projects p
        LEFT JOIN boreloge b ON p.project_id = b.project_id
        LEFT JOIN borelog_versions bv ON b.borelog_id = bv.borelog_id
        GROUP BY p.project_id, p.name
        ORDER BY p.name
      `;
    } else {
      // Project Managers can only see statistics for projects they're assigned to
      statisticsQuery = `
        SELECT 
          p.project_id,
          p.name as project_name,
          COUNT(b.borelog_id) as total_borelogs,
          COUNT(CASE WHEN bv.status = 'draft' THEN 1 END) as draft_count,
          COUNT(CASE WHEN bv.status = 'submitted' THEN 1 END) as submitted_count,
          COUNT(CASE WHEN bv.status = 'approved' THEN 1 END) as approved_count,
          COUNT(CASE WHEN bv.status = 'rejected' THEN 1 END) as rejected_count,
          COUNT(CASE WHEN bv.status = 'returned_for_revision' THEN 1 END) as returned_count
        FROM projects p
        JOIN user_project_assignments upa ON p.project_id = upa.project_id
        LEFT JOIN boreloge b ON p.project_id = b.project_id
        LEFT JOIN borelog_versions bv ON b.borelog_id = bv.borelog_id
        WHERE $1 = ANY(upa.assignee)
        GROUP BY p.project_id, p.name
        ORDER BY p.name
      `;
      queryParams = [payload.userId];
    }

    const statistics = await db.query(statisticsQuery, queryParams);

    // Calculate overall totals
    const totals = statistics.reduce((acc, project) => ({
      total_borelogs: acc.total_borelogs + parseInt(project.total_borelogs || '0'),
      draft_count: acc.draft_count + parseInt(project.draft_count || '0'),
      submitted_count: acc.submitted_count + parseInt(project.submitted_count || '0'),
      approved_count: acc.approved_count + parseInt(project.approved_count || '0'),
      rejected_count: acc.rejected_count + parseInt(project.rejected_count || '0'),
      returned_count: acc.returned_count + parseInt(project.returned_count || '0')
    }), {
      total_borelogs: 0,
      draft_count: 0,
      submitted_count: 0,
      approved_count: 0,
      rejected_count: 0,
      returned_count: 0
    });

    const response = createResponse(200, {
      success: true,
      message: 'Workflow statistics retrieved successfully',
      data: {
        projects: statistics,
        totals
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error getting workflow statistics:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to get workflow statistics'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Get submitted borelogs (for Site Engineers)
export const getSubmittedBorelogs = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has Site Engineer role
    const authError = await checkRole(['Site Engineer', 'Admin'])(event);
    if (authError !== null) {
      return authError;
    }

    // Get user info from token
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

    // Get submitted borelogs for projects the user is assigned to
    let submittedBorelogsQuery: string;
    let queryParams: any[] = [];

    if (payload.role === 'Admin') {
             // Admin can see all submitted borelogs
       submittedBorelogsQuery = `
         SELECT 
           bv.borelog_id,
           bv.version_no,
           bv.status,
           bv.submitted_by,
           bv.submitted_at,
           bv.submission_comments,
           bv.review_comments,
           bv.approved_by,
           bv.approved_at,
           bv.rejected_by,
           bv.rejected_at,
           bv.returned_by,
           bv.returned_at,
           b.project_id,
           b.substructure_id,
           b.type as borelog_type,
           p.name as project_name,
           ss.type as substructure_name,
           u.name as submitted_by_name,
           ua.name as approved_by_name,
           ur.name as rejected_by_name,
           urt.name as returned_by_name
         FROM borelog_versions bv
         JOIN boreloge b ON bv.borelog_id = b.borelog_id
         JOIN projects p ON b.project_id = p.project_id
         LEFT JOIN sub_structures ss ON b.substructure_id = ss.substructure_id
         LEFT JOIN users u ON bv.submitted_by = u.user_id
         LEFT JOIN users ua ON bv.approved_by = ua.user_id
         LEFT JOIN users ur ON bv.rejected_by = ur.user_id
         LEFT JOIN users urt ON bv.returned_by = urt.user_id
         WHERE bv.status IN ('submitted', 'approved', 'rejected', 'returned_for_revision')
         ORDER BY bv.submitted_at DESC
       `;
    } else {
             // Site Engineers can only see submitted borelogs for projects they're assigned to
       submittedBorelogsQuery = `
         SELECT 
           bv.borelog_id,
           bv.version_no,
           bv.status,
           bv.submitted_by,
           bv.submitted_at,
           bv.submission_comments,
           bv.review_comments,
           bv.approved_by,
           bv.approved_at,
           bv.rejected_by,
           bv.rejected_at,
           bv.returned_by,
           bv.returned_at,
           b.project_id,
           b.substructure_id,
           b.type as borelog_type,
           p.name as project_name,
           ss.type as substructure_name,
           u.name as submitted_by_name,
           ua.name as approved_by_name,
           ur.name as rejected_by_name,
           urt.name as returned_by_name
         FROM borelog_versions bv
         JOIN boreloge b ON bv.borelog_id = b.borelog_id
         JOIN projects p ON b.project_id = p.project_id
         LEFT JOIN sub_structures ss ON b.substructure_id = ss.substructure_id
         LEFT JOIN users u ON bv.submitted_by = u.user_id
         LEFT JOIN users ua ON bv.approved_by = ua.user_id
         LEFT JOIN users ur ON bv.rejected_by = ur.user_id
         LEFT JOIN users urt ON bv.returned_by = urt.user_id
         JOIN user_project_assignments upa ON p.project_id = upa.project_id
         WHERE bv.status IN ('submitted', 'approved', 'rejected', 'returned_for_revision') 
           AND $1 = ANY(upa.assignee)
         ORDER BY bv.submitted_at DESC
       `;
      queryParams = [payload.userId];
    }

    const submittedBorelogs = await db.query(submittedBorelogsQuery, queryParams);

    const response = createResponse(200, {
      success: true,
      message: 'Submitted borelogs retrieved successfully',
      data: submittedBorelogs
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error getting submitted borelogs:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to get submitted borelogs'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

