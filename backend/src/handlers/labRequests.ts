import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger } from '../utils/logger';
import { createResponse } from '../types/common';
import { createStorageClient } from '../storage/s3Client';

// Type definitions for database results
interface BorelogResult {
  borelog_id: string;
  project_name: string;
  borehole_number: string;
  chainage_km?: string;
}

interface LabAssignmentResult {
  assignment_id: string;
  borelog_id: string;
  sample_ids: string[];
  assigned_to: string;
  priority: string;
  due_date: string | null;
  assigned_at: string;
  assigned_by: string;
  notes: string | null;
  project_name: string;
  borehole_number: string;
  assigned_by_name: string;
  assigned_lab_engineer_name: string;
}

interface LabRequestDetailResult {
  assignment_id: string;
  borelog_id: string;
  sample_ids: string[];
  assigned_to: string;
  priority: string;
  due_date: string | null;
  assigned_at: string;
  assigned_by: string;
  notes: string | null;
  project_name: string;
  borehole_number: string;
  assigned_by_name: string;
  report_id?: string; // Optional since it might not exist for old records
}

interface FinalBorelogResult {
  borelog_id: string;
  borehole_number: string;
  created_at: string;
  project_name: string;
  project_location: string;
  version_no: number;
}

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  name?: string;
}

// Helper function to extract assignment_id from request ID
const extractAssignmentId = (requestId: string): string | null => {
  // Request ID format can be either:
  // 1. assignment_id-index (e.g., "7424ba93-9229-4f56-93aa-053840df0be6-0")
  // 2. assignment_id (e.g., "f8bf2120-9a88-456d-a462-0f7535a949b5")
  
  if (!requestId || typeof requestId !== 'string') {
    return null;
  }
  
  const parts = requestId.split('-');
  
  // If it's a complete UUID (5 parts), return it as is
  if (parts.length === 5) {
    return requestId;
  }
  
  // If it has more than 5 parts, it's in format assignment_id-index
  if (parts.length > 5) {
    // Remove the last part (index) and join the rest back together
    const assignmentId = parts.slice(0, -1).join('-');
    // Verify that the extracted part is a valid UUID (5 parts)
    if (assignmentId.split('-').length === 5) {
      return assignmentId;
    }
  }
  
  // Invalid format
  return null;
};

// Create new lab request
export const createLabRequest = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('createLabRequest');
  if (dbGuard) return dbGuard;

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager'])(event);
    if (authError !== null) {
      return authError;
    }

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

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.borelog_id || !body.sample_id || !body.test_type) {
      return createResponse(400, {
        success: false,
        message: 'Missing required fields',
        error: 'borelog_id, sample_id, and test_type are required'
      });
    }

    // Check if borelog exists
    const borelogQuery = `
      SELECT b.*, p.name as project_name, bd.number as borehole_number
      FROM boreloge b 
      JOIN projects p ON b.project_id = p.project_id
      LEFT JOIN borelog_details bd ON b.borelog_id = bd.borelog_id
      WHERE b.borelog_id = $1
    `;
    const borelogResult = await db.query(borelogQuery, [body.borelog_id]) as BorelogResult[];
    
    if (borelogResult.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: 'Borelog with the specified ID does not exist'
      });
    }

    const borelog = borelogResult[0] as any;
    const requestId = uuidv4();
    const reportId = uuidv4(); // Create report_id immediately

    // Create lab request record
    const createQuery = `
      INSERT INTO lab_test_assignments (
        assignment_id, borelog_id, version_no, sample_ids, assigned_by, 
        assigned_to, due_date, priority, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      requestId,
      body.borelog_id,
      1, // Default version_no
      [body.sample_id], // Convert to array
      payload.userId,
      payload.userId, // For now, assign to the same user
      body.due_date || null,
      body.priority || 'normal',
      body.notes || null
    ];

    const result = await db.query(createQuery, values) as LabAssignmentResult[];
    
    // Create initial unified lab report record (minimal record, will be updated by triggers)
    const createReportQuery = `
      INSERT INTO unified_lab_reports (
        report_id, assignment_id, borelog_id, sample_id, project_name, borehole_no, 
        client, test_date, tested_by, checked_by, approved_by, test_types, 
        soil_test_data, rock_test_data, status, remarks, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (report_id) DO NOTHING
    `;
    
    await db.query(createReportQuery, [
      reportId, requestId, body.borelog_id, body.sample_id, borelog.project_name, borelog.borehole_number,
      body.client || '', new Date().toISOString(), 'TBD', 'TBD', 'TBD', JSON.stringify([body.test_type]),
      JSON.stringify([]), JSON.stringify([]), 'draft', body.notes || '', payload.userId
    ]);

    // Create initial version record
    const createVersionQuery = `
      INSERT INTO lab_report_versions (
        report_id, version_no, assignment_id, borelog_id, sample_id, project_name, borehole_no,
        client, test_date, tested_by, checked_by, approved_by, test_types, 
        soil_test_data, rock_test_data, status, remarks, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    `;

    await db.query(createVersionQuery, [
      reportId, 1, requestId, body.borelog_id, body.sample_id, borelog.project_name, borelog.borehole_number,
      body.client || '', new Date().toISOString(), 'TBD', 'TBD', 'TBD', JSON.stringify([body.test_type]),
      JSON.stringify([]), JSON.stringify([]), 'draft', body.notes || '', payload.userId
    ]);
    
    logger.info('Lab request and initial report created successfully', { 
      requestId, 
      reportId, 
      borelogId: body.borelog_id 
    });

    return createResponse(201, {
      success: true,
      message: 'Lab request created successfully',
      data: {
        id: result[0].assignment_id,
        report_id: reportId, // Include the report_id in response
        borelog_id: result[0].borelog_id,
        sample_id: result[0].sample_ids[0], // Get first sample ID from array
        test_type: body.test_type, // Keep the test_type from request
        priority: result[0].priority,
        due_date: result[0].due_date,
        notes: result[0].notes,
        requested_by: payload.name || payload.email,
        requested_date: result[0].assigned_at,
        status: 'assigned', // Default status
        borelog: {
          borehole_number: borelog.borehole_number,
          project_name: borelog.project_name,
          chainage: borelog.chainage_km || 'N/A'
        }
      }
    });
  } catch (error) {
    logger.error('Error creating lab request:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create lab request'
    });
  }
};

/**
 * List lab requests - derive from approved borelogs (S3-only)
 */
async function listLabRequestsFromS3(
  storageClient: ReturnType<typeof createStorageClient>,
  userId: string,
  userRole: string
): Promise<any[]> {
  try {
    const allKeys = await storageClient.listFiles('projects/', 50000);
    
    // Find all borelog metadata files
    const metadataKeys = allKeys.filter(
      (k) => k.endsWith('/metadata.json') && 
             k.includes('/borelogs/borelog_') && 
             !k.includes('/versions/') && 
             !k.includes('/parsed/')
    );

    const labRequests: any[] = [];

    // Process each borelog
    for (const metadataKey of metadataKeys) {
      try {
        // Extract project_id and borelog_id from path
        const pathMatch = metadataKey.match(/projects\/project_([^/]+)\/borelogs\/borelog_([^/]+)\/metadata\.json/);
        if (!pathMatch) continue;

        const [, projectId, borelogId] = pathMatch;

        // Read workflow.json to check if approved
        const workflowKey = `projects/project_${projectId}/borelogs/borelog_${borelogId}/workflow.json`;
        let workflow: any = null;
        
        if (await storageClient.fileExists(workflowKey)) {
          try {
            const workflowBuffer = await storageClient.downloadFile(workflowKey);
            workflow = JSON.parse(workflowBuffer.toString('utf-8'));
          } catch (error) {
            logger.warn('Error reading workflow.json', { workflowKey, error });
            continue;
          }
        } else {
          // Skip if no workflow (not approved)
          continue;
        }

        // Only process approved borelogs
        const status = workflow?.status?.toUpperCase();
        if (status !== 'APPROVED') {
          continue;
        }

        // Read project and borelog metadata
        let projectName: string | undefined;
        let boreholeNumber: string | undefined;
        try {
          const projectKey = `projects/project_${projectId}/project.json`;
          if (await storageClient.fileExists(projectKey)) {
            const projectBuffer = await storageClient.downloadFile(projectKey);
            const projectData = JSON.parse(projectBuffer.toString('utf-8'));
            projectName = projectData.name;
          }

          const metadataBuffer = await storageClient.downloadFile(metadataKey);
          const metadata = JSON.parse(metadataBuffer.toString('utf-8'));
          boreholeNumber = metadata.borehole_number || metadata.number;
        } catch (error) {
          logger.warn('Error reading project/borelog metadata', { projectId, borelogId, error });
        }

        // Check for explicit lab/requests.json
        const labRequestsKey = `projects/project_${projectId}/borelogs/borelog_${borelogId}/lab/requests.json`;
        let explicitRequests: any[] = [];
        let hasExplicitRequests = false;

        if (await storageClient.fileExists(labRequestsKey)) {
          try {
            const requestsBuffer = await storageClient.downloadFile(labRequestsKey);
            const requestsData = JSON.parse(requestsBuffer.toString('utf-8'));
            explicitRequests = Array.isArray(requestsData) ? requestsData : 
                             (requestsData.requests ? requestsData.requests : []);
            hasExplicitRequests = explicitRequests.length > 0;
          } catch (error) {
            logger.warn('Error reading lab requests.json', { labRequestsKey, error });
          }
        }

        if (hasExplicitRequests) {
          // Use explicit requests
          explicitRequests.forEach((req: any, index: number) => {
            const sampleIds = Array.isArray(req.sample_ids) ? req.sample_ids : 
                            (req.sample_id ? [req.sample_id] : []);
            
            if (sampleIds.length === 0) {
              labRequests.push({
                id: `${req.assignment_id || borelogId}-${index}`,
                assignment_id: req.assignment_id || `${borelogId}-${index}`,
                borelog_id: borelogId,
                sample_id: '',
                test_type: req.test_type || 'Lab Test',
                priority: req.priority || 'normal',
                due_date: req.due_date || null,
                notes: req.notes || null,
                requested_by: req.assigned_by_name || req.requested_by || 'Unknown',
                requested_date: req.assigned_at || req.requested_date || new Date().toISOString(),
                status: req.status || 'assigned',
                assigned_lab_engineer: req.assigned_lab_engineer_name || req.assigned_to || null,
                borelog: {
                  borehole_number: boreholeNumber || 'N/A',
                  project_name: projectName || projectId,
                  chainage: 'N/A'
                }
              });
            } else {
              sampleIds.forEach((sampleId: string, sampleIndex: number) => {
                labRequests.push({
                  id: `${req.assignment_id || borelogId}-${index}-${sampleIndex}`,
                  assignment_id: req.assignment_id || `${borelogId}-${index}`,
                  borelog_id: borelogId,
                  sample_id: sampleId,
                  test_type: req.test_type || 'Lab Test',
                  priority: req.priority || 'normal',
                  due_date: req.due_date || null,
                  notes: req.notes || null,
                  requested_by: req.assigned_by_name || req.requested_by || 'Unknown',
                  requested_date: req.assigned_at || req.requested_date || new Date().toISOString(),
                  status: req.status || 'assigned',
                  assigned_lab_engineer: req.assigned_lab_engineer_name || req.assigned_to || null,
                  borelog: {
                    borehole_number: boreholeNumber || 'N/A',
                    project_name: projectName || projectId,
                    chainage: 'N/A'
                  }
                });
              });
            }
          });
        } else {
          // Infer pending requests from parsed strata (samples that need lab testing)
          const versionKeys = allKeys.filter(k => 
            k.includes(`/borelog_${borelogId}/parsed/v`) && 
            k.endsWith('/strata.json')
          );

          for (const strataKey of versionKeys) {
            try {
              const versionMatch = strataKey.match(/\/parsed\/v(\d+)\/strata\.json/);
              if (!versionMatch) continue;
              const versionNo = parseInt(versionMatch[1], 10);

              const strataBuffer = await storageClient.downloadFile(strataKey);
              const parsedData = JSON.parse(strataBuffer.toString('utf-8'));

              // Extract samples
              const allSamples: any[] = [];
              (parsedData.strata || []).forEach((stratum: any) => {
                (stratum.samples || []).forEach((sample: any) => {
                  allSamples.push(sample);
                });
              });

              // Create pending request for each sample
              allSamples.forEach((sample, index) => {
                const sampleId = sample.id || sample.sample_code || `sample-${index}`;
                const assignmentId = `${borelogId}-v${versionNo}-${sampleId}`;

                labRequests.push({
                  id: `${assignmentId}-0`,
                  assignment_id: assignmentId,
                  borelog_id: borelogId,
                  sample_id: sampleId,
                  test_type: 'Lab Test',
                  priority: 'normal',
                  due_date: null,
                  notes: null,
                  requested_by: workflow.submitted_by || 'System',
                  requested_date: workflow.submitted_at || new Date().toISOString(),
                  status: 'PENDING',
                  assigned_lab_engineer: null,
                  borelog: {
                    borehole_number: boreholeNumber || 'N/A',
                    project_name: projectName || projectId,
                    chainage: 'N/A'
                  }
                });
              });
            } catch (error) {
              logger.warn('Error processing parsed strata for lab requests', { strataKey, error });
              continue;
            }
          }
        }
      } catch (error) {
        logger.warn('Error processing borelog for lab requests', { metadataKey, error });
        continue;
      }
    }

    // Filter by user role
    let filteredRequests = labRequests;
    if (userRole === 'Lab Engineer') {
      // Lab engineers see requests assigned to them or pending
      filteredRequests = labRequests.filter(req => 
        !req.assigned_lab_engineer || 
        req.assigned_lab_engineer === userId ||
        req.status === 'PENDING'
      );
    }
    // Admin and Project Manager see all requests

    // Sort by requested_date descending
    filteredRequests.sort((a, b) => {
      const dateA = a.requested_date ? new Date(a.requested_date).getTime() : 0;
      const dateB = b.requested_date ? new Date(b.requested_date).getTime() : 0;
      return dateB - dateA;
    });

    return filteredRequests;
  } catch (error) {
    logger.error('Error listing lab requests from S3', { error });
    return [];
  }
}

// Get all lab requests
export const listLabRequests = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Lab Engineer'])(event);
    if (authError !== null) {
      return authError;
    }

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

    const storageClient = createStorageClient();
    const labRequests = await listLabRequestsFromS3(
      storageClient,
      payload.userId,
      payload.role
    );

    return createResponse(200, {
      success: true,
      message: 'Lab requests retrieved successfully',
      data: labRequests
    });
  } catch (error) {
    logger.error('Error listing lab requests:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve lab requests'
    });
  }
};

// Get lab request by ID
export const getLabRequestById = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('getLabRequestById');
  if (dbGuard) return dbGuard;

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Lab Engineer'])(event);
    if (authError !== null) {
      return authError;
    }

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

    const requestId = event.pathParameters?.id;
    if (!requestId) {
      return createResponse(400, {
        success: false,
        message: 'Missing request ID',
        error: 'Request ID is required'
      });
    }

    // Extract the actual assignment_id from the request ID first
    const assignmentId = extractAssignmentId(requestId);
    
    if (!assignmentId) {
      return createResponse(400, {
        success: false,
        message: 'Invalid request ID format',
        error: 'Request ID must be either a valid UUID or in format: assignment_id-index'
      });
    }

    // Validate the extracted assignment_id is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(assignmentId)) {
      return createResponse(400, {
        success: false,
        message: 'Invalid assignment ID format',
        error: `Assignment ID must be a valid UUID. Received: ${assignmentId}`
      });
    }

    const query = `
      SELECT 
        lta.*,
        p.name as project_name,
        COALESCE(bd.number, 'N/A') as borehole_number,
        COALESCE(u.name, 'Unknown') as assigned_by_name,
        ulr.report_id
      FROM lab_test_assignments lta
      LEFT JOIN boreloge b ON lta.borelog_id = b.borelog_id
      LEFT JOIN projects p ON b.project_id = p.project_id
      LEFT JOIN (
        SELECT DISTINCT ON (borelog_id) borelog_id, number
        FROM borelog_details 
        ORDER BY borelog_id, version_no DESC
      ) bd ON lta.borelog_id = bd.borelog_id
      LEFT JOIN users u ON lta.assigned_by = u.user_id
      LEFT JOIN unified_lab_reports ulr ON lta.assignment_id = ulr.assignment_id
      WHERE lta.assignment_id = $1
    `;

    logger.info('Executing lab request query:', { assignmentId, query });
    
    let result;
    try {
      result = await db.query(query, [assignmentId]) as LabRequestDetailResult[];
    } catch (dbError) {
      logger.error('Database query error in getLabRequestById:', dbError);
      return createResponse(500, {
        success: false,
        message: 'Database query error',
        error: 'Failed to execute database query'
      });
    }
    
    if (!result || result.length === 0) {
      logger.info('Lab request not found:', { assignmentId });
      return createResponse(404, {
        success: false,
        message: 'Lab request not found',
        error: 'Lab request with the specified ID does not exist'
      });
    }

    const row = result[0];
    logger.info('Lab request data retrieved:', { 
      assignment_id: row.assignment_id,
      borelog_id: row.borelog_id,
      project_name: row.project_name,
      borehole_number: row.borehole_number,
      report_id: row.report_id
    });
    
    const labRequest = {
      id: row.assignment_id,
      report_id: row.report_id, // Include the report_id
      borelog_id: row.borelog_id,
      sample_id: row.sample_ids ? row.sample_ids[0] : '', // Get first sample ID from array
      test_type: 'Lab Test', // Default test type since it's not stored in the table
      priority: row.priority,
      due_date: row.due_date,
      notes: row.notes,
      requested_by: row.assigned_by_name,
      requested_date: row.assigned_at,
      status: 'assigned', // Default status
      borelog: {
        borehole_number: row.borehole_number,
        project_name: row.project_name,
        chainage: 'N/A'
      }
    };

    return createResponse(200, {
      success: true,
      message: 'Lab request retrieved successfully',
      data: labRequest
    });
  } catch (error) {
    logger.error('Error getting lab request:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve lab request'
    });
  }
};

// Update lab request
export const updateLabRequest = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('updateLabRequest');
  if (dbGuard) return dbGuard;

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager'])(event);
    if (authError !== null) {
      return authError;
    }

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

    const requestId = event.pathParameters?.id;
    if (!requestId) {
      return createResponse(400, {
        success: false,
        message: 'Missing request ID',
        error: 'Request ID is required'
      });
    }

    // Extract the actual assignment_id from the request ID
    const assignmentId = extractAssignmentId(requestId);
    
    if (!assignmentId) {
      return createResponse(400, {
        success: false,
        message: 'Invalid request ID format',
        error: 'Request ID must be either a valid UUID or in format: assignment_id-index'
      });
    }

    // Validate the extracted assignment_id is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(assignmentId)) {
      return createResponse(400, {
        success: false,
        message: 'Invalid assignment ID format',
        error: `Assignment ID must be a valid UUID. Received: ${assignmentId}`
      });
    }

    const body = JSON.parse(event.body || '{}');
    
    // Build update query dynamically
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (body.sample_id !== undefined) {
      paramCount++;
      updateFields.push(`sample_ids = $${paramCount}`);
      values.push([body.sample_id]); // Convert to array
    }

    // Note: test_type is not stored in the lab_test_assignments table
    // It would need to be stored in a separate table or handled differently

    if (body.priority !== undefined) {
      paramCount++;
      updateFields.push(`priority = $${paramCount}`);
      values.push(body.priority);
    }

    if (body.due_date !== undefined) {
      paramCount++;
      updateFields.push(`due_date = $${paramCount}`);
      values.push(body.due_date);
    }

    if (body.notes !== undefined) {
      paramCount++;
      updateFields.push(`notes = $${paramCount}`);
      values.push(body.notes);
    }

    // Note: status is not stored in the lab_test_assignments table
    // It would need to be stored in a separate table or handled differently

    if (updateFields.length === 0) {
      return createResponse(400, {
        success: false,
        message: 'No fields to update',
        error: 'At least one field must be provided for update'
      });
    }

    paramCount++;
    values.push(assignmentId);

    const updateQuery = `
      UPDATE lab_test_assignments 
      SET ${updateFields.join(', ')}
      WHERE assignment_id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);
    
    if (result.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Lab request not found',
        error: 'Lab request with the specified ID does not exist'
      });
    }

    logger.info('Lab request updated successfully', { requestId, assignmentId });

    return createResponse(200, {
      success: true,
      message: 'Lab request updated successfully',
      data: result[0]
    });
  } catch (error) {
    logger.error('Error updating lab request:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to update lab request'
    });
  }
};

// Delete lab request
export const deleteLabRequest = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('deleteLabRequest');
  if (dbGuard) return dbGuard;

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin'])(event);
    if (authError !== null) {
      return authError;
    }

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

    const requestId = event.pathParameters?.id;
    if (!requestId) {
      return createResponse(400, {
        success: false,
        message: 'Missing request ID',
        error: 'Request ID is required'
      });
    }

    // Extract the actual assignment_id from the request ID
    const assignmentId = extractAssignmentId(requestId);
    
    if (!assignmentId) {
      return createResponse(400, {
        success: false,
        message: 'Invalid request ID format',
        error: 'Request ID must be either a valid UUID or in format: assignment_id-index'
      });
    }

    // Validate the extracted assignment_id is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(assignmentId)) {
      return createResponse(400, {
        success: false,
        message: 'Invalid assignment ID format',
        error: `Assignment ID must be a valid UUID. Received: ${assignmentId}`
      });
    }

    const deleteQuery = `
      DELETE FROM lab_test_assignments 
      WHERE assignment_id = $1
      RETURNING assignment_id
    `;

    const result = await db.query(deleteQuery, [assignmentId]);
    
    if (result.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Lab request not found',
        error: 'Lab request with the specified ID does not exist'
      });
    }

    logger.info('Lab request deleted successfully', { requestId, assignmentId });

    return createResponse(200, {
      success: true,
      message: 'Lab request deleted successfully',
      data: null
    });
  } catch (error) {
    logger.error('Error deleting lab request:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to delete lab request'
    });
  }
};

/**
 * Get final borelogs from S3 - approved borelogs with samples requiring lab tests
 * A final borelog = borelog that satisfies ALL:
 * - workflow.status === "APPROVED"
 * - has samples requiring lab tests
 * - (no lab results yet OR partially completed)
 */
async function getFinalBorelogsFromS3(
  storageClient: ReturnType<typeof createStorageClient>
): Promise<FinalBorelogResult[]> {
  try {
    const allKeys = await storageClient.listFiles('projects/', 50000);
    
    // Find all borelog metadata files
    const metadataKeys = allKeys.filter(
      (k) => k.endsWith('/metadata.json') && 
             k.includes('/borelogs/borelog_') && 
             !k.includes('/versions/') && 
             !k.includes('/parsed/')
    );

    const finalBorelogs: FinalBorelogResult[] = [];

    // Process each borelog
    for (const metadataKey of metadataKeys) {
      try {
        // Extract project_id and borelog_id from path
        const pathMatch = metadataKey.match(/projects\/project_([^/]+)\/borelogs\/borelog_([^/]+)\/metadata\.json/);
        if (!pathMatch) continue;

        const [, projectId, borelogId] = pathMatch;

        // Read workflow.json to check if approved
        const workflowKey = `projects/project_${projectId}/borelogs/borelog_${borelogId}/workflow.json`;
        let workflow: any = null;
        
        if (await storageClient.fileExists(workflowKey)) {
          try {
            const workflowBuffer = await storageClient.downloadFile(workflowKey);
            workflow = JSON.parse(workflowBuffer.toString('utf-8'));
          } catch (error) {
            logger.warn('Error reading workflow.json', { workflowKey, error });
            continue;
          }
        } else {
          // Skip if no workflow (not approved)
          continue;
        }

        // Only process approved borelogs
        const status = workflow?.status?.toUpperCase();
        if (status !== 'APPROVED') {
          continue;
        }

        // Find latest version from parsed strata
        const versionKeys = allKeys.filter(k => 
          k.includes(`/borelog_${borelogId}/parsed/v`) && 
          k.endsWith('/strata.json')
        );

        if (versionKeys.length === 0) {
          // No parsed strata, skip
          continue;
        }

        // Get the latest version
        let latestVersion = 0;
        let latestVersionKey: string | null = null;
        for (const strataKey of versionKeys) {
          const versionMatch = strataKey.match(/\/parsed\/v(\d+)\/strata\.json/);
          if (!versionMatch) continue;
          const versionNo = parseInt(versionMatch[1], 10);
          if (versionNo > latestVersion) {
            latestVersion = versionNo;
            latestVersionKey = strataKey;
          }
        }

        if (!latestVersionKey) {
          continue;
        }

        // Read strata.json to check for samples
        let hasSamples = false;
        try {
          const strataBuffer = await storageClient.downloadFile(latestVersionKey);
          const parsedData = JSON.parse(strataBuffer.toString('utf-8'));

          // Extract samples
          const allSamples: any[] = [];
          (parsedData.strata || []).forEach((stratum: any) => {
            (stratum.samples || []).forEach((sample: any) => {
              allSamples.push(sample);
            });
          });

          hasSamples = allSamples.length > 0;
        } catch (error) {
          logger.warn('Error reading strata.json', { latestVersionKey, error });
          continue;
        }

        if (!hasSamples) {
          // No samples, skip
          continue;
        }

        // Check lab/results.json - if it doesn't exist or is incomplete, treat as pending
        const labResultsKey = `projects/project_${projectId}/borelogs/borelog_${borelogId}/lab/results.json`;
        let labResults: any = null;
        let hasLabResults = false;
        
        if (await storageClient.fileExists(labResultsKey)) {
          try {
            const resultsBuffer = await storageClient.downloadFile(labResultsKey);
            labResults = JSON.parse(resultsBuffer.toString('utf-8'));
            // Check if results exist and are not empty
            hasLabResults = labResults && (
              (Array.isArray(labResults) && labResults.length > 0) ||
              (typeof labResults === 'object' && Object.keys(labResults).length > 0)
            );
          } catch (error) {
            logger.warn('Error reading lab results.json', { labResultsKey, error });
            // Treat as no results if we can't read it
            hasLabResults = false;
          }
        }

        // Include if no lab results yet (pending lab work)
        if (!hasLabResults) {
          // Read project and borelog metadata
          let projectName: string | undefined;
          let projectLocation: string | undefined;
          let boreholeNumber: string | undefined;
          let createdAt: string | undefined;
          
          try {
            const projectKey = `projects/project_${projectId}/project.json`;
            if (await storageClient.fileExists(projectKey)) {
              const projectBuffer = await storageClient.downloadFile(projectKey);
              const projectData = JSON.parse(projectBuffer.toString('utf-8'));
              projectName = projectData.name;
              projectLocation = projectData.location;
            }

            const metadataBuffer = await storageClient.downloadFile(metadataKey);
            const metadata = JSON.parse(metadataBuffer.toString('utf-8'));
            boreholeNumber = metadata.borehole_number || metadata.number;
            createdAt = metadata.created_at || workflow.submitted_at || new Date().toISOString();
          } catch (error) {
            logger.warn('Error reading project/borelog metadata', { projectId, borelogId, error });
            // Continue with partial data
          }

          finalBorelogs.push({
            borelog_id: borelogId,
            borehole_number: boreholeNumber || 'N/A',
            project_name: projectName || projectId,
            project_location: projectLocation || 'N/A',
            version_no: latestVersion,
            created_at: createdAt || new Date().toISOString()
          });
        }
      } catch (error) {
        logger.warn('Error processing borelog for final borelogs', { metadataKey, error });
        continue;
      }
    }

    // Sort by created_at descending (latest first)
    finalBorelogs.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    return finalBorelogs;
  } catch (error) {
    logger.error('Error getting final borelogs from S3', { error });
    return [];
  }
}

// Get final borelogs for lab requests (accessible by Project Managers and Lab Engineers)
export const getFinalBorelogs = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Lab Engineer'])(event);
    if (authError !== null) {
      return authError;
    }

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

    const storageClient = createStorageClient();
    const finalBorelogs = await getFinalBorelogsFromS3(storageClient);

    return createResponse(200, {
      success: true,
      message: 'Final borelogs retrieved successfully',
      data: finalBorelogs
    });
  } catch (error) {
    logger.error('Error getting final borelogs:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve final borelogs'
    });
  }
};
