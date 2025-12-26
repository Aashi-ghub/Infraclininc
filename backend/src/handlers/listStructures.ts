import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { createStorageClient } from '../storage/s3Client';
import * as fs from 'fs/promises';
import * as path from 'path';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

    const projectId = event.queryStringParameters?.project_id;
    if (!projectId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing project_id parameter',
        error: 'project_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get structures from S3
    const storageClient = createStorageClient();
    const structuresPrefix = `projects/project_${projectId}/structures/`;
    
    let structureKeys: string[] = [];
    
    const storageMode = (process.env.STORAGE_MODE || '').toLowerCase();
    const isOffline = storageMode !== 's3' && process.env.IS_OFFLINE === 'true';

    // Handle local filesystem mode (offline) differently
    if (isOffline) {
      const localStoragePath = process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), 'local-storage');
      const structuresDir = path.join(localStoragePath, structuresPrefix);
      
      try {
        const entries = await fs.readdir(structuresDir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.startsWith('structure_')) {
            const structureJsonPath = path.join(structuresDir, entry.name, 'structure.json');
            try {
              await fs.access(structureJsonPath);
              structureKeys.push(`${structuresPrefix}${entry.name}/structure.json`);
            } catch {
              continue;
            }
          }
        }
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          logger.error('Error listing local structure directories:', error);
        }
      }
    } else {
      // For S3, use listFiles which handles recursive listing
      const allKeys = await storageClient.listFiles(structuresPrefix, 10000);
      structureKeys = allKeys.filter(key => key.endsWith('/structure.json'));
    }

    // Read and parse each structure.json
    const structurePromises = structureKeys.map(async (key) => {
      try {
        const structureBuffer = await storageClient.downloadFile(key);
        const structure = JSON.parse(structureBuffer.toString('utf-8'));
        
        return {
          structure_id: structure.structure_id,
          project_id: structure.project_id,
          type: structure.type,
          description: structure.description,
          created_at: structure.created_at,
          updated_at: structure.updated_at,
          created_by_user_id: structure.created_by_user_id
        };
      } catch (error) {
        logger.error(`Error reading structure from S3 key ${key}:`, error);
        return null;
      }
    });
    
    const structureResults = await Promise.all(structurePromises);
    const structures = structureResults
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    logger.info(`[S3 READ ENABLED] listStructures count=${structures.length} project_id=${projectId}`);
    
    const response = createResponse(200, {
      success: true,
      message: 'Structures retrieved successfully',
      data: structures
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error listing structures:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve structures'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 
