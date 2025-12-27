import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { createStorageClient } from '../storage/s3Client';
import { validate as validateUUID } from 'uuid';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer'])(event);
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

    const substructureId = event.pathParameters?.substructure_id;
    if (!substructureId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing substructure_id parameter',
        error: 'substructure_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    if (!validateUUID(substructureId)) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid substructure_id format',
        error: 'substructure_id must be a valid UUID'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const storageClient = createStorageClient();

    // Find borelog metadata by scanning borelogs metadata files
    const borelogsKeys = await storageClient.listFiles('projects/', 20000);
    const metadataKeys = borelogsKeys.filter(k => k.endsWith('/metadata.json') && k.includes('/borelogs/') && !k.includes('/versions/'));

    let borelogMeta: any = null;
    let basePath: string | null = null;

    for (const key of metadataKeys) {
      try {
        const buf = await storageClient.downloadFile(key);
        const meta = JSON.parse(buf.toString('utf-8'));
        if (meta?.substructure_id === substructureId) {
          borelogMeta = meta;
          basePath = key.replace(/\/metadata\.json$/, '');
          break;
        }
      } catch (err) {
        continue;
      }
    }

    if (!borelogMeta || !basePath) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: 'No borelog found for the specified substructure_id'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const projectId = borelogMeta.project_id;

    // Load project info if available
    let projectInfo: any = null;
    try {
      const projBuf = await storageClient.downloadFile(`projects/${projectId}/project.json`);
      projectInfo = JSON.parse(projBuf.toString('utf-8'));
    } catch {
      // optional
    }

    // Load substructure/structure info if available
    let substructureInfo: any = null;
    let structureInfo: any = null;
    try {
      const structureKeys = await storageClient.listFiles(`projects/${projectId}/structures/`, 10000);
      const subKey = structureKeys.find(k => k.includes(`substructure_${substructureId}/substructure.json`));
      if (subKey) {
        const subBuf = await storageClient.downloadFile(subKey);
        substructureInfo = JSON.parse(subBuf.toString('utf-8'));
        const structKey = structureKeys.find(k => k.includes(`structure_${substructureInfo.structure_id}/structure.json`) && !k.includes('substructures'));
        if (structKey) {
          const structBuf = await storageClient.downloadFile(structKey);
          structureInfo = JSON.parse(structBuf.toString('utf-8'));
        }
      }
    } catch {
      // optional
    }

    // Build version history from version metadata files
    let versionHistory: any[] = [];
    try {
      const versionKeys = await storageClient.listFiles(`${basePath}/versions/`, 10000);
      const metadataVersionKeys = versionKeys.filter(k => k.endsWith('/metadata.json'));
      versionHistory = await Promise.all(metadataVersionKeys.map(async k => {
        try {
          const buf = await storageClient.downloadFile(k);
          const meta = JSON.parse(buf.toString('utf-8'));
          return {
            version_no: meta.version,
            created_at: meta.created_at,
            status: meta.status || 'DRAFT',
            created_by: {
              user_id: meta.created_by,
              name: null,
              email: null
            },
            details: {} // details not available from S3 metadata
          };
        } catch {
          return null;
        }
      }));
      versionHistory = versionHistory.filter(Boolean).sort((a, b) => (b?.version_no || 0) - (a?.version_no || 0));
    } catch {
      versionHistory = [];
    }

    const latestVersion = versionHistory.length > 0 ? versionHistory[0] : null;

    const response = createResponse(200, {
      success: true,
      message: 'Borelog retrieved successfully',
      data: {
        borelog_id: borelogMeta.borelog_id,
        borelog_type: borelogMeta.type,
        project: {
          project_id: projectId,
          name: projectInfo?.name || null,
          location: projectInfo?.location || null
        },
        structure: {
          structure_type: structureInfo?.type || null,
          description: structureInfo?.description || null,
          substructure_type: substructureInfo?.type || null,
          substructure_remark: substructureInfo?.remark || null,
          tunnel_no: null,
          location: null,
          chainage: null,
          borehole_number: null,
          borehole_msl: null,
          borehole_coordinate: null,
          borehole_boring_method: null,
          borehole_hole_diameter: null,
          borehole_description: null,
          borehole_coordinates_json: null
        },
        version_history: versionHistory,
        latest_version: latestVersion
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error retrieving borelog by substructure_id:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve borelog'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};
