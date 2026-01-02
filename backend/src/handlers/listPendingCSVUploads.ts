import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { createStorageClient } from '../storage/s3Client';

/**
 * List pending CSV uploads from S3
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });
  
  try {
    // Only Approval Engineer, Admin, or Project Manager can view pending CSV uploads
    const authError = await checkRole(['Admin', 'Approval Engineer', 'Project Manager'])(event);
    if (authError) {
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

    // Get query parameters
    const projectId = event.queryStringParameters?.project_id;
    const status = event.queryStringParameters?.status || 'pending';
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const offset = parseInt(event.queryStringParameters?.offset || '0');

    const storageClient = createStorageClient();
    const pendingUploads: any[] = [];

    // List all projects or specific project
    const projectPrefix = projectId 
      ? `projects/project_${projectId}/`
      : 'projects/';
    
    const allKeys = await storageClient.listFiles(projectPrefix, 50000);
    
    // Find all manifest.json files in uploads/csv/ directories
    const manifestKeys = allKeys.filter(k => 
      k.includes('/uploads/csv/manifest.json') && 
      k.includes('/versions/v')
    );

    logger.info(`Found ${manifestKeys.length} CSV upload manifests in S3`);

    // Process each manifest to determine if it's pending
    for (const manifestKey of manifestKeys) {
      try {
        // Extract project_id, borelog_id, and version_no from path
        // Format: projects/project_{projectId}/borelogs/borelog_{borelogId}/versions/v{versionNo}/uploads/csv/manifest.json
        const pathMatch = manifestKey.match(/projects\/project_([^/]+)\/borelogs\/borelog_([^/]+)\/versions\/v(\d+)\/uploads\/csv\/manifest\.json/);
        if (!pathMatch) continue;

        const [, extractedProjectId, extractedBorelogId, versionNoStr] = pathMatch;
        const versionNo = parseInt(versionNoStr, 10);

        // Skip if project filter doesn't match
        if (projectId && extractedProjectId !== projectId) continue;

        // Read manifest
        const manifestBuffer = await storageClient.downloadFile(manifestKey);
        const manifest = JSON.parse(manifestBuffer.toString('utf-8'));

        // Check if parsed output exists
        const parsedStrataKey = `projects/project_${extractedProjectId}/borelogs/borelog_${extractedBorelogId}/parsed/v${versionNo}/strata.json`;
        const parsedExists = await storageClient.fileExists(parsedStrataKey);

        // Check workflow status
        const workflowKey = `projects/project_${extractedProjectId}/borelogs/borelog_${extractedBorelogId}/workflow.json`;
        const workflowExists = await storageClient.fileExists(workflowKey);
        
        let workflowStatus = null;
        if (workflowExists) {
          try {
            const workflowBuffer = await storageClient.downloadFile(workflowKey);
            const workflow = JSON.parse(workflowBuffer.toString('utf-8'));
            workflowStatus = workflow.status;
          } catch (error) {
            logger.warn('Error reading workflow.json', { workflowKey, error });
          }
        }

        // Determine if upload is pending
        // Pending if: parsed output doesn't exist OR workflow status is not SUBMITTED/APPROVED
        const isPending = !parsedExists || 
          (workflowStatus !== 'SUBMITTED' && workflowStatus !== 'APPROVED');

        // Apply status filter
        if (status === 'pending' && !isPending) continue;
        if (status === 'approved' && workflowStatus !== 'APPROVED') continue;
        if (status === 'submitted' && workflowStatus !== 'SUBMITTED') continue;
        if (status !== 'all' && status !== 'pending' && status !== 'approved' && status !== 'submitted') {
          // Unknown status filter, skip
          continue;
        }

        // Read project metadata if available
        let projectName = null;
        try {
          const projectKey = `projects/project_${extractedProjectId}/project.json`;
          if (await storageClient.fileExists(projectKey)) {
            const projectBuffer = await storageClient.downloadFile(projectKey);
            const projectData = JSON.parse(projectBuffer.toString('utf-8'));
            projectName = projectData.name || null;
          }
        } catch (error) {
          logger.warn('Error reading project metadata', { projectId: extractedProjectId, error });
        }

        // Read borelog metadata if available
        let structureId = null;
        let substructureId = null;
        let structureType = null;
        let substructureType = null;
        try {
          const borelogMetadataKey = `projects/project_${extractedProjectId}/borelogs/borelog_${extractedBorelogId}/metadata.json`;
          if (await storageClient.fileExists(borelogMetadataKey)) {
            const borelogBuffer = await storageClient.downloadFile(borelogMetadataKey);
            const borelogData = JSON.parse(borelogBuffer.toString('utf-8'));
            structureId = borelogData.structure_id || null;
            substructureId = borelogData.substructure_id || null;
          }
        } catch (error) {
          logger.warn('Error reading borelog metadata', { borelogId: extractedBorelogId, error });
        }

        // Try to read parsed strata for preview (first 3 layers)
        let stratumPreview: any[] = [];
        let totalStratumLayers = 0;
        let borelogHeader: any = {};
        let processedAt: string | null = null;
        
        if (parsedExists) {
          try {
            const parsedBuffer = await storageClient.downloadFile(parsedStrataKey);
            const parsedData = JSON.parse(parsedBuffer.toString('utf-8'));
            stratumPreview = (parsedData.strata || []).slice(0, 3);
            totalStratumLayers = parsedData.strata?.length || 0;
            borelogHeader = parsedData.borehole?.metadata || {};
            processedAt = parsedData.borehole?.parsed_at || null;
          } catch (error) {
            logger.warn('Error reading parsed strata for preview', { parsedStrataKey, error });
          }
        }

        // Get submitted_at from workflow if available
        let submittedForApprovalAt: string | null = null;
        if (workflowStatus === 'SUBMITTED' && workflowExists) {
          try {
            const workflowBuffer = await storageClient.downloadFile(workflowKey);
            const workflow = JSON.parse(workflowBuffer.toString('utf-8'));
            submittedForApprovalAt = workflow.submitted_at || null;
          } catch (error) {
            logger.warn('Error reading workflow for submitted_at', { workflowKey, error });
          }
        }

        // Generate upload_id from path (deterministic: borelog_id-v{version_no})
        const uploadId = `${extractedBorelogId}-v${versionNo}`;

        // Map to expected response format
        const upload = {
          upload_id: uploadId,
          project_id: extractedProjectId,
          structure_id: structureId,
          substructure_id: substructureId,
          uploaded_by: manifest.uploaded_by || null,
          uploaded_by_name: null, // User names not stored in S3
          uploaded_at: manifest.uploaded_at || new Date().toISOString(),
          file_name: manifest.original_filename || 'unknown.csv',
          file_type: manifest.file_type || 'csv',
          total_records: totalStratumLayers,
          status: isPending ? 'pending' : (workflowStatus?.toLowerCase() || 'processed'),
          submitted_for_approval_at: submittedForApprovalAt,
          approved_by: workflowStatus === 'APPROVED' ? null : null, // Not stored in workflow.json yet
          approved_at: null,
          rejected_by: null,
          rejected_at: null,
          returned_by: null,
          returned_at: null,
          approval_comments: null,
          rejection_reason: null,
          revision_notes: null,
          processed_at: processedAt,
          created_borelog_id: extractedBorelogId,
          error_message: null,
          project_name: projectName,
          structure_type: structureType,
          substructure_type: substructureType,
          borelog_header: borelogHeader,
          stratum_preview: stratumPreview,
          total_stratum_layers: totalStratumLayers
        };

        pendingUploads.push(upload);
      } catch (error) {
        logger.warn('Error processing manifest', { manifestKey, error });
        continue;
      }
    }

    // Sort by uploaded_at descending
    pendingUploads.sort((a, b) => {
      const dateA = new Date(a.uploaded_at).getTime();
      const dateB = new Date(b.uploaded_at).getTime();
      return dateB - dateA;
    });

    // Apply pagination
    const total = pendingUploads.length;
    const paginatedUploads = pendingUploads.slice(offset, offset + limit);

    const response = createResponse(200, {
      success: true,
      message: `Retrieved ${paginatedUploads.length} CSV uploads`,
      data: {
        uploads: paginatedUploads,
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + limit < total
        }
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error listing pending CSV uploads from S3:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to list pending CSV uploads'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};
