import { APIGatewayProxyEvent } from 'aws-lambda';
import { getAllGeologicalLogs } from '../models/geologicalLog';
import { createResponse } from '../types/common';
import { logger, logRequest, logResponse } from '../utils/logger';
import { checkRole, validateToken } from '../utils/validateInput';
import { getAssignedBorelogsForSiteEngineer } from '../utils/projectAccess';
import { createStorageClient } from '../storage/s3Client';
import { listParquetEntities, ParquetEntityType } from '../services/parquetService';

export const handler = async (event: APIGatewayProxyEvent) => {
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

    let geologicalLogs;

    // For Site Engineers, only show assigned geological logs
    if (payload.role === 'Site Engineer') {
      const assignedBorelogIds = await getAssignedBorelogsForSiteEngineer(payload.userId);
      
      if (assignedBorelogIds.length === 0) {
        // No assignments, return empty list
        geologicalLogs = [];
      } else {
        // Get all geological logs and filter by assigned borelog IDs
        const allLogs = await getAllGeologicalLogs();
        geologicalLogs = allLogs.filter(log => 
          assignedBorelogIds.includes(log.borelog_id)
        );
      }
    } else {
      // For other roles, get all geological logs (S3/Parquet only)
      geologicalLogs = await listAllGeologicalLogsFromStorage();
    }

    const response = createResponse(200, {
      success: true,
      message: 'Geological logs retrieved successfully',
      data: geologicalLogs
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error retrieving all geological logs', { error });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve geological logs'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 

/**
 * List all geological logs by scanning S3 projects and invoking Parquet service
 */
async function listAllGeologicalLogsFromStorage() {
  const storage = createStorageClient();
  const projectIds = await listProjectIds(storage);

  const allLogs: any[] = [];
  for (const projectId of projectIds) {
    try {
      const logs = await listParquetEntities(ParquetEntityType.GEOLOGICAL_LOG, projectId);
      logs.forEach(result => {
        const data = result.data || result;
        allLogs.push({
          ...data,
          coordinate: data.coordinate_latitude && data.coordinate_longitude
            ? {
                type: 'Point' as const,
                coordinates: [data.coordinate_longitude, data.coordinate_latitude]
              }
            : undefined,
          size_of_core_pieces_distribution: data.size_of_core_pieces_distribution
            ? (typeof data.size_of_core_pieces_distribution === 'string'
                ? JSON.parse(data.size_of_core_pieces_distribution)
                : data.size_of_core_pieces_distribution)
            : undefined,
          created_at: new Date(data.created_at || Date.now()),
          updated_at: new Date(data.updated_at || Date.now()),
          created_by_user_id: data.created_by_user_id || null,
        });
      });
    } catch (err) {
      logger.warn(`Could not list geological logs for project ${projectId}`, { err });
    }
  }

  // Sort by created_at desc
  return allLogs.sort((a, b) => {
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    return bTime - aTime;
  });
}

/**
 * Discover project IDs from S3 project folder names
 * Supports both new (`projects/{id}`) and legacy (`projects/project_{id}`) naming.
 */
async function listProjectIds(storage: ReturnType<typeof createStorageClient>): Promise<string[]> {
  const keys = await storage.listFiles('projects/', 10000);
  const ids = new Set<string>();

  for (const key of keys) {
    const parts = key.split('/');
    if (parts.length < 2) continue;
    // Expect "projects/{something}/..."
    const candidate = parts[1];
    if (!candidate) continue;

    if (candidate.startsWith('project_')) {
      ids.add(candidate.replace('project_', ''));
    } else {
      ids.add(candidate);
    }
  }

  return Array.from(ids);
}
