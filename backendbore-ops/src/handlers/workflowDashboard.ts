import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { createStorageClient } from '../storage/s3Client';

/**
 * MIGRATED: This handler now reads workflow state dynamically from S3
 * Workflow status is stored at: projects/{projectId}/borelogs/{borelogId}/workflow.json
 */

interface WorkflowState {
  status: string;
  submitted_at?: string;
  submitted_by?: string;
  version_no?: number;
  comments?: string | null;
}

interface BorelogWithWorkflow {
  borelog_id: string;
  project_id: string;
  project_name?: string;
  structure_id?: string;
  substructure_id?: string;
  workflow: WorkflowState | null;
  metadata: any;
}

/**
 * List all borelogs with their workflow status from S3
 */
async function listAllBorelogsWithWorkflow(
  storageClient: ReturnType<typeof createStorageClient>
): Promise<BorelogWithWorkflow[]> {
  try {
    const allKeys = await storageClient.listFiles('projects/', 50000);
    
    // Find all borelog metadata files
    const metadataKeys = allKeys.filter(
      (k) => k.endsWith('/metadata.json') && 
             k.includes('/borelogs/borelog_') && 
             !k.includes('/versions/') && 
             !k.includes('/parsed/')
    );

    logger.info(`Found ${metadataKeys.length} borelog metadata files in S3`);

    const borelogs: BorelogWithWorkflow[] = [];

    // Process each borelog
    for (const metadataKey of metadataKeys) {
      try {
        // Extract project_id and borelog_id from path
        // Format: projects/project_{projectId}/borelogs/borelog_{borelogId}/metadata.json
        const pathMatch = metadataKey.match(/projects\/project_([^/]+)\/borelogs\/borelog_([^/]+)\/metadata\.json/);
        if (!pathMatch) continue;

        const [, projectId, borelogId] = pathMatch;

        // Read borelog metadata
        const metadataBuffer = await storageClient.downloadFile(metadataKey);
        const metadata = JSON.parse(metadataBuffer.toString('utf-8'));

        // Read workflow.json if it exists
        const workflowKey = `projects/project_${projectId}/borelogs/borelog_${borelogId}/workflow.json`;
        let workflow: WorkflowState | null = null;
        
        if (await storageClient.fileExists(workflowKey)) {
          try {
            const workflowBuffer = await storageClient.downloadFile(workflowKey);
            workflow = JSON.parse(workflowBuffer.toString('utf-8'));
          } catch (error) {
            logger.warn('Error reading workflow.json', { workflowKey, error });
          }
        }

        // Read project name if available
        let projectName: string | undefined;
        try {
          const projectKey = `projects/project_${projectId}/project.json`;
          if (await storageClient.fileExists(projectKey)) {
            const projectBuffer = await storageClient.downloadFile(projectKey);
            const projectData = JSON.parse(projectBuffer.toString('utf-8'));
            projectName = projectData.name;
          }
        } catch (error) {
          logger.warn('Error reading project metadata', { projectId, error });
        }

        borelogs.push({
          borelog_id: borelogId,
          project_id: projectId,
          project_name: projectName,
          structure_id: metadata.structure_id,
          substructure_id: metadata.substructure_id,
          workflow,
          metadata
        });
      } catch (error) {
        logger.warn('Error processing borelog metadata', { metadataKey, error });
        continue;
      }
    }

    return borelogs;
  } catch (error) {
    logger.error('Error listing borelogs with workflow from S3', { error });
    return [];
  }
}

/**
 * Get pending reviews - borelogs with status SUBMITTED (not APPROVED/REJECTED)
 */
async function getPendingReviewsFromS3(
  storageClient: ReturnType<typeof createStorageClient>
): Promise<any[]> {
  const borelogs = await listAllBorelogsWithWorkflow(storageClient);
  
  return borelogs
    .filter(b => {
      const status = b.workflow?.status?.toUpperCase();
      return status === 'SUBMITTED';
    })
    .map(b => ({
      borelog_id: b.borelog_id,
      project_id: b.project_id,
      project_name: b.project_name,
      structure_id: b.structure_id,
      substructure_id: b.substructure_id,
      submitted_at: b.workflow?.submitted_at || null,
      submitted_by: b.workflow?.submitted_by || null,
      version_no: b.workflow?.version_no || null,
      comments: b.workflow?.comments || null,
      status: 'submitted'
    }))
    .sort((a, b) => {
      const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return dateB - dateA; // Latest first
    });
}

/**
 * Get lab assignments - borelogs with status APPROVED and lab assignment not completed
 */
async function getLabAssignmentsFromS3(
  storageClient: ReturnType<typeof createStorageClient>
): Promise<any[]> {
  const borelogs = await listAllBorelogsWithWorkflow(storageClient);
  
  return borelogs
    .filter(b => {
      const status = b.workflow?.status?.toUpperCase();
      return status === 'APPROVED';
    })
    .map(b => ({
      borelog_id: b.borelog_id,
      project_id: b.project_id,
      project_name: b.project_name,
      structure_id: b.structure_id,
      substructure_id: b.substructure_id,
      approved_at: null, // Not stored in workflow.json yet
      approved_by: null, // Not stored in workflow.json yet
      version_no: b.workflow?.version_no || null,
      status: 'approved',
      // Lab assignment completion check would go here if lab data exists
      lab_assignment_completed: false // Default to false for now
    }))
    .sort((a, b) => {
      // Sort by project name or borelog_id
      const nameA = a.project_name || a.borelog_id;
      const nameB = b.project_name || b.borelog_id;
      return nameA.localeCompare(nameB);
    });
}

/**
 * Get submitted borelogs - borelogs with status SUBMITTED
 */
async function getSubmittedBorelogsFromS3(
  storageClient: ReturnType<typeof createStorageClient>,
  userId?: string
): Promise<any[]> {
  const borelogs = await listAllBorelogsWithWorkflow(storageClient);
  
  return borelogs
    .filter(b => {
      const status = b.workflow?.status?.toUpperCase();
      const isSubmitted = status === 'SUBMITTED';
      // Filter by user if provided (for Site Engineers)
      if (userId && b.workflow?.submitted_by !== userId) {
        return false;
      }
      return isSubmitted;
    })
    .map(b => ({
      borelog_id: b.borelog_id,
      project_id: b.project_id,
      project_name: b.project_name,
      structure_id: b.structure_id,
      substructure_id: b.substructure_id,
      submitted_at: b.workflow?.submitted_at || null,
      submitted_by: b.workflow?.submitted_by || null,
      version_no: b.workflow?.version_no || null,
      comments: b.workflow?.comments || null,
      status: 'submitted'
    }))
    .sort((a, b) => {
      const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return dateB - dateA; // Latest first
    });
}

/**
 * Get workflow statistics - compute counts dynamically from S3
 */
async function getWorkflowStatisticsFromS3(
  storageClient: ReturnType<typeof createStorageClient>
): Promise<any> {
  const borelogs = await listAllBorelogsWithWorkflow(storageClient);
  
  // Aggregate by project
  const projectStats = new Map<string, {
    project_id: string;
    project_name: string;
    total_borelogs: number;
    draft_count: number;
    submitted_count: number;
    approved_count: number;
    rejected_count: number;
    returned_count: number;
  }>();

  // Overall totals
  let totalBorelogs = 0;
  let draftCount = 0;
  let submittedCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let returnedCount = 0;

  for (const borelog of borelogs) {
    totalBorelogs++;
    const status = borelog.workflow?.status?.toUpperCase() || 'DRAFT';
    
    // Get or create project stats
    if (!projectStats.has(borelog.project_id)) {
      projectStats.set(borelog.project_id, {
        project_id: borelog.project_id,
        project_name: borelog.project_name || borelog.project_id,
        total_borelogs: 0,
        draft_count: 0,
        submitted_count: 0,
        approved_count: 0,
        rejected_count: 0,
        returned_count: 0
      });
    }
    const projectStat = projectStats.get(borelog.project_id)!;
    projectStat.total_borelogs++;
    
    // Update counts
    switch (status) {
      case 'SUBMITTED':
        submittedCount++;
        projectStat.submitted_count++;
        break;
      case 'APPROVED':
        approvedCount++;
        projectStat.approved_count++;
        break;
      case 'REJECTED':
        rejectedCount++;
        projectStat.rejected_count++;
        break;
      case 'RETURNED_FOR_REVISION':
      case 'RETURNED':
        returnedCount++;
        projectStat.returned_count++;
        break;
      case 'DRAFT':
      default:
        draftCount++;
        projectStat.draft_count++;
        break;
    }
  }

  // Convert project stats to array and format as strings (matching frontend expectation)
  const projects = Array.from(projectStats.values()).map(p => ({
    project_id: p.project_id,
    project_name: p.project_name,
    total_borelogs: String(p.total_borelogs),
    draft_count: String(p.draft_count),
    submitted_count: String(p.submitted_count),
    approved_count: String(p.approved_count),
    rejected_count: String(p.rejected_count),
    returned_count: String(p.returned_count)
  }));

  return {
    totals: {
      total_borelogs: totalBorelogs,
      draft_count: draftCount,
      submitted_count: submittedCount,
      approved_count: approvedCount,
      rejected_count: rejectedCount,
      returned_count: returnedCount
    },
    projects
  };
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

    const storageClient = createStorageClient();
    const pendingReviews = await getPendingReviewsFromS3(storageClient);

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

    const storageClient = createStorageClient();
    const labAssignments = await getLabAssignmentsFromS3(storageClient);

    // Filter by assigned user if not Admin
    const filteredAssignments = payload.role === 'Admin' 
      ? labAssignments
      : labAssignments.filter((a: any) => a.assigned_to === payload.userId);

    const response = createResponse(200, {
      success: true,
      message: 'Lab assignments retrieved successfully',
      data: filteredAssignments
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

    const storageClient = createStorageClient();
    const statistics = await getWorkflowStatisticsFromS3(storageClient);

    const response = createResponse(200, {
      success: true,
      message: 'Workflow statistics retrieved successfully',
      data: statistics
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

    const storageClient = createStorageClient();
    const submittedBorelogs = await getSubmittedBorelogsFromS3(storageClient, payload.userId);

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
