import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { createStorageClient } from '../storage/s3Client';

/**
 * MIGRATED: This handler now reads from S3 instead of database
 * S3 Structure:
 * - Pending reviews: workflow/pending-reviews.json
 * - Workflow stats: workflow/statistics.json
 * - Submitted borelogs: workflow/submitted-borelogs.json
 */

/**
 * List pending reviews from S3
 */
async function listPendingReviewsFromS3(payload: any): Promise<any[]> {
  const storageClient = createStorageClient();
  try {
    const key = 'workflow/pending-reviews.json';
    const buf = await storageClient.downloadFile(key);
    const reviews = JSON.parse(buf.toString('utf-8')) as any[];
    return reviews;
  } catch (error) {
    logger.warn('Could not read pending reviews from S3, returning empty array', { error });
    return [];
  }
}

/**
 * Get workflow statistics from S3
 */
async function getWorkflowStatsFromS3(payload: any): Promise<any[]> {
  const storageClient = createStorageClient();
  try {
    const key = 'workflow/statistics.json';
    const buf = await storageClient.downloadFile(key);
    const stats = JSON.parse(buf.toString('utf-8')) as any[];
    return stats;
  } catch (error) {
    logger.warn('Could not read workflow statistics from S3, returning empty array', { error });
    return [];
  }
}

/**
 * List submitted borelogs from S3
 */
async function listSubmittedBorelogsFromS3(payload: any): Promise<any[]> {
  const storageClient = createStorageClient();
  try {
    const key = 'workflow/submitted-borelogs.json';
    const buf = await storageClient.downloadFile(key);
    const borelogs = JSON.parse(buf.toString('utf-8')) as any[];
    // Filter by user if needed
    return borelogs.filter((b: any) => b.submitted_by === payload.userId || payload.role === 'Admin');
  } catch (error) {
    logger.warn('Could not read submitted borelogs from S3, returning empty array', { error });
    return [];
  }
}

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

    const pendingReviews = await listPendingReviewsFromS3(payload);

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

/**
 * Get lab assignments from S3
 */
async function getLabAssignmentsFromS3(payload: any): Promise<any[]> {
  const storageClient = createStorageClient();
  try {
    const key = 'workflow/lab-assignments.json';
    const buf = await storageClient.downloadFile(key);
    const assignments = JSON.parse(buf.toString('utf-8')) as any[];
    // Filter by assigned user
    return assignments.filter((a: any) => a.assigned_to === payload.userId || payload.role === 'Admin');
  } catch (error) {
    logger.warn('Could not read lab assignments from S3, returning empty array', { error });
    return [];
  }
}

// Get lab assignments (for Lab Engineers)
export const getLabAssignments = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // MIGRATED: Removed DB guard - now S3-only
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

    const labAssignments = await getLabAssignmentsFromS3(payload);

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

    const statistics = await getWorkflowStatsFromS3(payload);

    // Calculate overall totals
    const totals = statistics.reduce((acc: any, project: any) => ({
      total_borelogs: acc.total_borelogs + (project.total_borelogs || 0),
      draft_count: acc.draft_count + (project.draft_count || 0),
      submitted_count: acc.submitted_count + (project.submitted_count || 0),
      approved_count: acc.approved_count + (project.approved_count || 0),
      rejected_count: acc.rejected_count + (project.rejected_count || 0),
      returned_count: acc.returned_count + (project.returned_count || 0)
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

    const submittedBorelogs = await listSubmittedBorelogsFromS3(payload);

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

