import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { checkRole, validateToken } from '../utils/validateInput';
import { validate as validateUUID } from 'uuid';
import { createStorageClient } from '../storage/s3Client';

/**
 * Find borelog metadata and project info by scanning S3
 */
async function findBorelogMetadata(borelogId: string): Promise<{ projectId: string; basePath: string; metadata: any } | null> {
  const storageClient = createStorageClient();
  const keys = await storageClient.listFiles('projects/', 20000);
  const metadataKeys = keys.filter(k =>
    k.endsWith('/metadata.json') &&
    k.includes('/borelogs/') &&
    !k.includes('/versions/')
  );

  for (const key of metadataKeys) {
    try {
      const buf = await storageClient.downloadFile(key);
      const meta = JSON.parse(buf.toString('utf-8'));
      if (meta?.borelog_id === borelogId && meta?.project_id) {
        const basePath = key.replace(/\/metadata\.json$/, '');
        return { projectId: meta.project_id, basePath, metadata: meta };
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Check if project exists in S3 (for Project Manager access validation)
 */
async function projectExists(projectId: string): Promise<boolean> {
  const storageClient = createStorageClient();
  const projectKey = `projects/project_${projectId}/project.json`;
  try {
    return await storageClient.fileExists(projectKey);
  } catch {
    return false;
  }
}

/**
 * Delete all files under a borelog prefix in S3
 */
async function deleteBorelogFiles(basePath: string): Promise<void> {
  const storageClient = createStorageClient();
  const allFiles = await storageClient.listFiles(basePath, 10000);
  
  // Delete all files in parallel for optimal performance
  const deletePromises = allFiles.map(file => 
    storageClient.deleteFile(file).catch(err => {
      // Log but don't fail on individual file deletion errors
      logger.warn('Failed to delete file during borelog deletion', { file, error: err });
    })
  );
  
  await Promise.all(deletePromises);
  logger.info('Deleted all borelog files', { basePath, fileCount: allFiles.length });
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Admin and Project Manager can delete borelogs
    const authError = await checkRole(['Admin', 'Project Manager'])(event);
    if (authError !== null) {
      return authError;
    }

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

    const borelogId = event.pathParameters?.borelog_id || event.pathParameters?.borelogId;
    if (!borelogId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing borelog_id parameter',
        error: 'borelog_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    if (!validateUUID(borelogId)) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid borelog_id format',
        error: 'borelog_id must be a valid UUID'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Find borelog metadata in S3
    const borelogInfo = await findBorelogMetadata(borelogId);
    if (!borelogInfo) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: `No borelog found with ID ${borelogId}`
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const { projectId, basePath } = borelogInfo;

    // For Project Managers, verify project exists (best-effort access check without DB)
    if (payload.role === 'Project Manager') {
      const exists = await projectExists(projectId);
      if (!exists) {
        const response = createResponse(403, {
          success: false,
          message: 'Access denied',
          error: 'You do not have permission to delete borelogs from this project'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
    }

    // Delete all files under the borelog prefix in S3
    await deleteBorelogFiles(basePath);

    const response = createResponse(200, {
      success: true,
      message: 'Borelog deleted successfully'
    });
    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error in deleteBorelog handler:', error);
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to delete borelog'
    });
    logResponse(response, Date.now() - startTime);
    return response;
  }
};


