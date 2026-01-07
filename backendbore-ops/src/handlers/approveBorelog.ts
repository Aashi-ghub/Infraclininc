import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { z } from 'zod';
import { createStorageClient } from '../storage/s3Client';

// Support both legacy and V2 payloads
// Legacy: { is_approved: boolean; remarks?: string; version_no?: number }
// V2 (frontend): { version_no: number; approved_by?: string; approval_comments?: string }
const ApproveBorelogSchemaV1 = z.object({
  is_approved: z.boolean(),
  remarks: z.string().optional(),
  version_no: z.number().optional()
});

const ApproveBorelogSchemaV2 = z.object({
  version_no: z.number(),
  approved_by: z.string().optional(),
  approval_comments: z.string().optional()
});

// S3 workflow keys (canonical)
const APPROVED_KEY = 'workflow/approved-borelogs.json';
const SUBMITTED_KEY = 'workflow/submitted-borelogs.json';
const STATS_KEY = 'workflow/statistics.json';

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
 * Read JSON from S3, return default if file doesn't exist
 */
async function readJson(
  storageClient: ReturnType<typeof createStorageClient>,
  key: string,
  defaultValue: any
): Promise<any> {
  try {
    if (await storageClient.fileExists(key)) {
      const buffer = await storageClient.downloadFile(key);
      return JSON.parse(buffer.toString('utf-8'));
    }
    return defaultValue;
  } catch (error) {
    logger.warn(`Error reading ${key}, using default`, { error });
    return defaultValue;
  }
}

/**
 * Write JSON to S3
 */
async function writeJson(
  storageClient: ReturnType<typeof createStorageClient>,
  key: string,
  data: any
): Promise<void> {
  const buffer = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
  await storageClient.uploadFile(key, buffer, 'application/json');
  logger.info(`[S3 WRITE] ${key}`);
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logger.info('[S3 READ ENABLED] approveBorelog');

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Only Approval Engineer and Admin can approve borelogs
    const authError = await checkRole(['Admin', 'Approval Engineer'])(event);
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

    // Find borelog metadata in S3
    const storageClient = createStorageClient();
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

    const { projectId, metadata } = borelogMeta;

    // Parse and validate request body
    if (!event.body) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing request body',
        error: 'Request body is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const requestBody = JSON.parse(event.body);
    const parsedV1 = ApproveBorelogSchemaV1.safeParse(requestBody);
    const parsedV2 = ApproveBorelogSchemaV2.safeParse(requestBody);

    if (!parsedV1.success && !parsedV2.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: [
          ...parsedV1.success ? [] : parsedV1.error.errors.map(err => `v1:${err.path.join('.')}: ${err.message}`),
          ...parsedV2.success ? [] : parsedV2.error.errors.map(err => `v2:${err.path.join('.')}: ${err.message}`)
        ].join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const is_approved = parsedV2.success ? true : parsedV1.data.is_approved;
    const remarks = parsedV2.success ? parsedV2.data.approval_comments : parsedV1.data.remarks;
    const versionNoRaw = parsedV2.success 
      ? parsedV2.data.version_no 
      : (typeof parsedV1.data.version_no === 'number' ? parsedV1.data.version_no : (requestBody as any).version_no);

    // Only handle approval (rejection can be handled separately if needed)
    if (!is_approved) {
      const response = createResponse(400, {
        success: false,
        message: 'Rejection not yet implemented in S3 mode',
        error: 'Only approval is supported in S3-first mode'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    if (typeof versionNoRaw !== 'number') {
      const response = createResponse(400, {
        success: false,
        message: 'Missing version_no for approval',
        error: 'version_no must be provided when approving'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get latest version from metadata
    const latestVersion = metadata.versions && metadata.versions.length > 0
      ? metadata.versions[metadata.versions.length - 1]
      : null;

    if (!latestVersion || latestVersion.version !== versionNoRaw) {
      const response = createResponse(404, {
        success: false,
        message: 'Version not found',
        error: `Version ${versionNoRaw} not found for this borelog`
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Update workflow.json to APPROVED status
    const workflowKey = `projects/project_${projectId}/borelogs/borelog_${borelogId}/workflow.json`;
    const workflowState = {
      status: 'APPROVED',
      approved_at: new Date().toISOString(),
      approved_by: payload.userId,
      version_no: versionNoRaw,
      approval_comments: remarks || null,
      submitted_at: latestVersion.created_at || new Date().toISOString(),
      submitted_by: latestVersion.created_by || payload.userId
    };

    await writeJson(storageClient, workflowKey, workflowState);

    // Write approved entry to workflow/approved-borelogs.json
    const approved = await readJson(storageClient, APPROVED_KEY, []);
    
    // Check if already approved (prevent duplicates)
    const alreadyApproved = approved.some(
      (a: any) => a.borelog_id === borelogId && a.version_no === versionNoRaw
    );

    if (!alreadyApproved) {
      approved.push({
        borelog_id: borelogId,
        project_id: projectId,
        approved_at: new Date().toISOString(),
        approved_by: payload.userId,
        version_no: versionNoRaw,
        approval_comments: remarks || null
      });
      await writeJson(storageClient, APPROVED_KEY, approved);
    }

    // Remove from submitted list if exists
    const submitted = await readJson(storageClient, SUBMITTED_KEY, []);
    const filtered = submitted.filter(
      (b: any) => !(b.borelog_id === borelogId && b.version_no === versionNoRaw)
    );
    if (filtered.length !== submitted.length) {
      await writeJson(storageClient, SUBMITTED_KEY, filtered);
    }

    // Update workflow statistics
    const stats = await readJson(storageClient, STATS_KEY, {
      projects: [],
      totals: {
        total_borelogs: 0,
        draft_count: 0,
        submitted_count: 0,
        approved_count: 0,
        rejected_count: 0,
        returned_count: 0
      }
    });

    // Only update stats if this is a new approval
    const wasNewApproval = !alreadyApproved;
    if (wasNewApproval) {
      stats.totals.approved_count = (stats.totals.approved_count || 0) + 1;
      stats.totals.submitted_count = Math.max(0, (stats.totals.submitted_count || 0) - 1);
    }

    await writeJson(storageClient, STATS_KEY, stats);

    // Log the approval action
    logger.info(`Borelog ${borelogId} approved by user ${payload.userId}`, {
      borelogId,
      approvedBy: payload.userId,
      versionNo: versionNoRaw,
      remarks
    });

    const response = createResponse(200, {
      success: true,
      message: 'Borelog approved successfully',
      data: {
        borelog_id: borelogId,
        version_no: versionNoRaw,
        approved_by: payload.userId,
        approved_at: new Date().toISOString()
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error approving borelog:', error);

    const status = (error as any).statusCode || 500;
    const message = status === 404 ? 'Version not found for this borelog' : 'Internal server error';
    const errDetail = (error as Error).message || 'Failed to approve borelog';

    const response = createResponse(status, {
      success: false,
      message,
      error: errDetail
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 
