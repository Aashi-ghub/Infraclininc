import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { z } from 'zod';
import { createStorageClient } from '../storage/s3Client';

// Schema for submitting borelog for review
const SubmitForReviewSchema = z.object({
  comments: z.string().optional(),
  version_number: z.number().min(1)
});

// Schema for reviewing borelog
const ReviewBorelogSchema = z.object({
  action: z.enum(['approve', 'reject', 'return_for_revision']),
  comments: z.string().min(1, 'Comments are required'),
  version_number: z.number().min(1)
});

// Schema for assigning lab tests
const AssignLabTestsSchema = z.object({
  borelog_id: z.string().uuid('Invalid borelog ID'),
  sample_ids: z.array(z.string().min(1, 'Sample ID is required')),
  test_types: z.array(z.string().min(1, 'Test type is required')),
  assigned_lab_engineer: z.string().uuid('Invalid lab engineer ID'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  expected_completion_date: z.string().min(1, 'Expected completion date is required')
});

// Schema for submitting lab test results
const SubmitLabTestResultsSchema = z.object({
  assignment_id: z.string().uuid('Invalid assignment ID'),
  sample_id: z.string().min(1, 'Sample ID is required'),
  test_type: z.string().min(1, 'Test type is required'),
  test_date: z.string().min(1, 'Test date is required'),
  results: z.record(z.any()),
  remarks: z.string().optional()
});

/**
 * Find borelog metadata in S3 to get project_id
 */
async function findBorelogMetadataInS3(
  storageClient: ReturnType<typeof createStorageClient>,
  borelogId: string
): Promise<{ projectId: string; metadata: any; basePath: string } | null> {
  try {
    const keys = await storageClient.listFiles('projects/', 20000);
    const metadataKeys = keys.filter(
      (k) => k.endsWith('/metadata.json') && k.includes('/borelogs/borelog_') && !k.includes('/versions/') && !k.includes('/parsed/')
    );

    for (const key of metadataKeys) {
      try {
        const buf = await storageClient.downloadFile(key);
        const meta = JSON.parse(buf.toString('utf-8'));
        if (meta?.borelog_id === borelogId && meta?.project_id) {
          const basePath = key.replace(/\/metadata\.json$/, '');
          return { projectId: meta.project_id, metadata: meta, basePath };
        }
      } catch {
        continue;
      }
    }

    logger.warn('Could not find borelog metadata in S3', { borelogId });
    return null;
  } catch (error) {
    logger.error('Error finding borelog metadata in S3', { error, borelogId });
    return null;
  }
}

/**
 * Submit borelog for review using S3 storage
 */
export const submitForReview = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });
  try {
    // Check if user has Site Engineer role
    const authError = await checkRole(['Site Engineer', 'Admin', 'Project Manager'])(event);
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

    const borelogId = event.pathParameters?.borelog_id;
    if (!borelogId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing borelog_id parameter',
        error: 'borelog_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validationResult = SubmitForReviewSchema.safeParse(body);
    
    if (!validationResult.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: validationResult.error.errors.map((err: any) => err.message).join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const { comments, version_number } = validationResult.data;

    // Initialize S3 storage client
    const storageClient = createStorageClient();

    // Find borelog metadata in S3
    const borelogMeta = await findBorelogMetadataInS3(storageClient, borelogId);
    if (!borelogMeta) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: 'Borelog with the specified ID does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const { projectId } = borelogMeta;

    // Check if workflow.json already exists (for idempotency)
    const workflowKey = `projects/project_${projectId}/borelogs/borelog_${borelogId}/workflow.json`;
    const workflowExists = await storageClient.fileExists(workflowKey);

    if (workflowExists) {
      try {
        const existingWorkflowBuffer = await storageClient.downloadFile(workflowKey);
        const existingWorkflow = JSON.parse(existingWorkflowBuffer.toString('utf-8'));
        
        // Prevent re-submission if already APPROVED
        if (existingWorkflow.status === 'APPROVED') {
          const response = createResponse(400, {
            success: false,
            message: 'Cannot resubmit approved borelog',
            error: 'This borelog has already been approved and cannot be resubmitted'
          });
          logResponse(response, Date.now() - startTime);
          return response;
        }
      } catch (error) {
        logger.warn('Error reading existing workflow.json, proceeding with submission', { error, workflowKey });
      }
    }

    // Create workflow state payload
    const workflowState = {
      status: 'SUBMITTED',
      submitted_at: new Date().toISOString(),
      submitted_by: payload.userId,
      version_no: version_number,
      comments: comments || null
    };

    // Write workflow.json to S3
    const workflowBuffer = Buffer.from(JSON.stringify(workflowState, null, 2), 'utf-8');
    await storageClient.uploadFile(
      workflowKey,
      workflowBuffer,
      'application/json',
      {
        project_id: projectId,
        borelog_id: borelogId
      }
    );

    // Log the submission
    logger.info(`Borelog ${borelogId} submitted for review by user ${payload.userId} (S3 mode)`, {
      borelogId,
      submittedBy: payload.userId,
      versionNumber: version_number,
      comments,
      workflowKey
    });

    const response = createResponse(200, {
      success: true,
      message: 'Borelog submitted for review successfully',
      data: {
        borelog_id: borelogId,
        version_number,
        status: 'submitted',
        submitted_by: payload.userId,
        submitted_at: workflowState.submitted_at
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error submitting borelog for review (S3 mode):', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to submit borelog for review'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Review borelog (Approval Engineer/Admin)
export const reviewBorelog = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('reviewBorelog');
  if (dbGuard) return dbGuard;

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

    const borelogId = event.pathParameters?.borelog_id;
    if (!borelogId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing borelog_id parameter',
        error: 'borelog_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validationResult = ReviewBorelogSchema.safeParse(body);
    
    if (!validationResult.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: validationResult.error.errors.map((err: any) => err.message).join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const { action, comments, version_number } = validationResult.data;

    // Check if borelog exists
    const borelogQuery = `
      SELECT b.*, p.project_id 
      FROM boreloge b 
      JOIN projects p ON b.project_id = p.project_id 
      WHERE b.borelog_id = $1
    `;
    const borelogResult = await db.query(borelogQuery, [borelogId]);
    
    if (borelogResult.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: 'Borelog with the specified ID does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const borelog = borelogResult[0] as any;

    // Update borelog version status based on action
    let newStatus: string;
    let updateFields: string;
    let updateParams: any[];

         switch (action) {
       case 'approve':
         newStatus = 'approved';
         updateFields = `
           status = $1, 
           approved_by = $2, 
           approved_at = NOW(),
           review_comments = $5
         `;
         updateParams = [newStatus, payload.userId, borelogId, version_number, comments || null];
         break;
       case 'reject':
         newStatus = 'rejected';
         updateFields = `
           status = $1, 
           rejected_by = $2, 
           rejected_at = NOW(),
           review_comments = $5
         `;
         updateParams = [newStatus, payload.userId, borelogId, version_number, comments || null];
         break;
       case 'return_for_revision':
         newStatus = 'returned_for_revision';
         updateFields = `
           status = $1, 
           returned_by = $2, 
           returned_at = NOW(),
           review_comments = $5
         `;
         updateParams = [newStatus, payload.userId, borelogId, version_number, comments || null];
         break;
      default:
        const response = createResponse(400, {
          success: false,
          message: 'Invalid action',
          error: 'Action must be approve, reject, or return_for_revision'
        });
        logResponse(response, Date.now() - startTime);
        return response;
    }

         const updateQuery = `
       UPDATE borelog_versions 
       SET ${updateFields}
       WHERE borelog_id = $3 AND version_no = $4
     `;
     await db.query(updateQuery, updateParams);

     // Add review comment to review comments table
     if (comments && comments.trim()) {
       const commentType = action === 'approve' ? 'approval_comment' : 
                          action === 'reject' ? 'rejection_reason' : 
                          'correction_required';
       
       const commentQuery = `
         INSERT INTO borelog_review_comments (
           borelog_id, version_no, comment_type, comment_text, commented_by
         ) VALUES ($1, $2, $3, $4, $5)
       `;
       await db.query(commentQuery, [
         borelogId, 
         version_number, 
         commentType, 
         comments, 
         payload.userId
       ]);
     }

    // Log the review action
    logger.info(`Borelog ${borelogId} ${action} by user ${payload.userId}`, {
      borelogId,
      reviewedBy: payload.userId,
      action,
      versionNumber: version_number,
      comments
    });

    const response = createResponse(200, {
      success: true,
      message: `Borelog ${action} successfully`,
      data: {
        borelog_id: borelogId,
        version_number,
        status: newStatus,
        reviewed_by: payload.userId,
        reviewed_at: new Date().toISOString(),
        action
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error reviewing borelog:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to review borelog'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Assign lab tests (Project Manager/Admin)
export const assignLabTests = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('assignLabTests');
  if (dbGuard) return dbGuard;

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

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validationResult = AssignLabTestsSchema.safeParse(body);
    
    if (!validationResult.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: validationResult.error.errors.map((err: any) => err.message).join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const assignmentData = validationResult.data;

    // Check if borelog exists and is approved
    const borelogQuery = `
      SELECT b.*, p.project_id 
      FROM boreloge b 
      JOIN projects p ON b.project_id = p.project_id 
      WHERE b.borelog_id = $1
    `;
    const borelogResult = await db.query(borelogQuery, [assignmentData.borelog_id]);
    
    if (borelogResult.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: 'Borelog with the specified ID does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const borelog = borelogResult[0] as any;

    // Check if user has access to this project
    const accessQuery = `
      SELECT 1 FROM user_project_assignments 
      WHERE project_id = $1 AND $2 = ANY(assignee)
    `;
    const accessResult = await db.query(accessQuery, [(borelog as any).project_id, payload.userId]);
    
    if (accessResult.length === 0 && payload.role !== 'Admin') {
      const response = createResponse(403, {
        success: false,
        message: 'Access denied: User not assigned to this project',
        error: 'Insufficient permissions'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get the latest version number for the borelog
    const versionQuery = `
      SELECT COALESCE(MAX(version_no), 1) as latest_version
      FROM borelog_versions 
      WHERE borelog_id = $1
    `;
    const versionResult = await db.query(versionQuery, [assignmentData.borelog_id]);
    const versionNo = (versionResult[0] as any)?.latest_version || 1;

    // Create lab test assignment in the database
    const insertQuery = `
      INSERT INTO lab_test_assignments (
        borelog_id, 
        version_no, 
        sample_ids, 
        assigned_by, 
        assigned_to, 
        due_date, 
        priority, 
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING assignment_id
    `;
    
    const insertResult = await db.query(insertQuery, [
      assignmentData.borelog_id,
      versionNo,
      assignmentData.sample_ids,
      payload.userId,
      assignmentData.assigned_lab_engineer,
      assignmentData.expected_completion_date,
      assignmentData.priority,
      'Lab test assignment created via workflow'
    ]);

    const assignmentId = (insertResult[0] as any).assignment_id;

         // Create individual lab assignments for each sample
     const individualAssignments = [];
     for (let i = 0; i < assignmentData.sample_ids.length; i++) {
       const individualAssignment = {
         assignment_id: assignmentId,
         borelog_id: assignmentData.borelog_id,
         sample_id: assignmentData.sample_ids[i],
         test_type: assignmentData.test_types[i],
         assigned_lab_engineer: assignmentData.assigned_lab_engineer,
         priority: assignmentData.priority,
         expected_completion_date: assignmentData.expected_completion_date,
         status: 'assigned',
         assigned_by: payload.userId,
         assigned_at: new Date().toISOString()
       };
       
       individualAssignments.push(individualAssignment);
     }

    logger.info(`Lab tests assigned for borelog ${assignmentData.borelog_id} by user ${payload.userId}`, {
      borelogId: assignmentData.borelog_id,
      assignedBy: payload.userId,
      assignments: individualAssignments.length,
      assignmentId: assignmentId
    });

    const response = createResponse(201, {
      success: true,
      message: 'Lab tests assigned successfully',
      data: {
        assignments: individualAssignments,
        total_assigned: individualAssignments.length,
        assignment_id: assignmentId
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error assigning lab tests:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to assign lab tests'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Submit lab test results (Lab Engineer)
export const submitLabTestResults = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('submitLabTestResults');
  if (dbGuard) return dbGuard;

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

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validationResult = SubmitLabTestResultsSchema.safeParse(body);
    
    if (!validationResult.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: validationResult.error.errors.map((err: any) => err.message).join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const testData = validationResult.data;

    // In a real implementation, you would save the lab test results to a database
    // For now, we'll just return a success response
    const labTestResult = {
      id: `ltr-${Date.now()}`,
      assignment_id: testData.assignment_id,
      sample_id: testData.sample_id,
      test_type: testData.test_type,
      test_date: testData.test_date,
      results: testData.results,
      remarks: testData.remarks,
      submitted_by: payload.userId,
      submitted_at: new Date().toISOString(),
      status: 'completed'
    };

    logger.info(`Lab test results submitted by user ${payload.userId}`, {
      assignmentId: testData.assignment_id,
      sampleId: testData.sample_id,
      testType: testData.test_type,
      submittedBy: payload.userId
    });

    const response = createResponse(201, {
      success: true,
      message: 'Lab test results submitted successfully',
      data: labTestResult
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error submitting lab test results:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to submit lab test results'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Get workflow status for a borelog
export const getWorkflowStatus = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('getWorkflowStatus');
  if (dbGuard) return dbGuard;

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer'])(event);
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

    const borelogId = event.pathParameters?.borelog_id;
    if (!borelogId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing borelog_id parameter',
        error: 'borelog_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

         // Get borelog and its latest version status
     const statusQuery = `
       SELECT 
         b.borelog_id,
         b.project_id,
         b.substructure_id,
         b.type,
         bv.version_no,
         bv.status,
         bv.submitted_by,
         bv.submitted_at,
         bv.reviewed_by,
         bv.reviewed_at
       FROM boreloge b
       LEFT JOIN borelog_versions bv ON b.borelog_id = bv.borelog_id
       WHERE b.borelog_id = $1
       ORDER BY bv.version_no DESC
       LIMIT 1
     `;
    const statusResult = await db.query(statusQuery, [borelogId]);
    
    if (statusResult.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: 'Borelog with the specified ID does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const workflowStatus = statusResult[0] as any;

    // Get lab test assignments for this borelog
    const labTestsQuery = `
      SELECT 
        assignment_id,
        sample_id,
        test_type,
        status,
        assigned_at,
        expected_completion_date
      FROM lab_assignments
      WHERE borelog_id = $1
      ORDER BY assigned_at DESC
    `;
    
    // In a real implementation, you would query the lab_assignments table
    // For now, we'll return empty array
    const labTests = [];

         const response = createResponse(200, {
       success: true,
       message: 'Workflow status retrieved successfully',
       data: {
         borelog_id: borelogId,
         current_status: workflowStatus.status || 'draft',
         version_number: workflowStatus.version_no,
         submitted_by: workflowStatus.submitted_by,
         submitted_at: workflowStatus.submitted_at,
         reviewed_by: workflowStatus.reviewed_by,
         reviewed_at: workflowStatus.reviewed_at,
         lab_tests: labTests
       }
     });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error getting workflow status:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to get workflow status'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

