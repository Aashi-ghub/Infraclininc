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
    const structureId = event.queryStringParameters?.structure_id;

    if (!projectId && !structureId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing required parameter',
        error: 'Either project_id or structure_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get substructures from S3
    const storageClient = createStorageClient();
    let substructureKeys: string[] = [];
    
    if (structureId) {
      // List substructures for a specific structure
      // Need to find project_id first by checking all projects
      const projectKeys = await storageClient.listFiles('projects/', 10000);
      const projectJsonFiles = projectKeys.filter(k => k.endsWith('/project.json'));
      
      let foundProjectId: string | null = null;
      for (const projectKey of projectJsonFiles) {
        const match = projectKey.match(/projects\/project_([^\/]+)\/project\.json/);
        if (match) {
          const pid = match[1];
          const structureKey = `projects/project_${pid}/structures/structure_${structureId}/structure.json`;
          if (await storageClient.fileExists(structureKey)) {
            foundProjectId = pid;
            break;
          }
        }
      }
      
      if (!foundProjectId) {
        logger.error(`[S3 VERIFY FAIL] listSubstructures reason=Structure not found structure_id=${structureId}`);
        const response = createResponse(404, {
          success: false,
          message: 'Structure not found',
          error: 'Structure with the specified ID does not exist'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
      
      const substructuresPrefix = `projects/project_${foundProjectId}/structures/structure_${structureId}/substructures/`;
      
      const storageMode = (process.env.STORAGE_MODE || '').toLowerCase();
      const isOffline = storageMode !== 's3' && process.env.IS_OFFLINE === 'true';

      if (isOffline) {
        const localStoragePath = process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), 'local-storage');
        const substructuresDir = path.join(localStoragePath, substructuresPrefix);
        
        try {
          const entries = await fs.readdir(substructuresDir, { withFileTypes: true });
          
          for (const entry of entries) {
            if (entry.isDirectory() && entry.name.startsWith('substructure_')) {
              const substructureJsonPath = path.join(substructuresDir, entry.name, 'substructure.json');
              try {
                await fs.access(substructureJsonPath);
                substructureKeys.push(`${substructuresPrefix}${entry.name}/substructure.json`);
              } catch {
                continue;
              }
            }
          }
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            logger.error('Error listing local substructure directories:', error);
          }
        }
      } else {
        const allKeys = await storageClient.listFiles(substructuresPrefix, 10000);
        substructureKeys = allKeys.filter(key => key.endsWith('/substructure.json'));
      }
    } else {
      // List all substructures for a project
      const structuresPrefix = `projects/project_${projectId}/structures/`;
      const allKeys = await storageClient.listFiles(structuresPrefix, 10000);
      substructureKeys = allKeys.filter(key => key.endsWith('/substructure.json'));
    }

    // Read and parse each substructure.json
    const substructurePromises = substructureKeys.map(async (key) => {
      try {
        const substructureBuffer = await storageClient.downloadFile(key);
        const substructure = JSON.parse(substructureBuffer.toString('utf-8'));
        
        return {
          substructure_id: substructure.substructure_id,
          structure_id: substructure.structure_id,
          project_id: substructure.project_id,
          type: substructure.type,
          remark: substructure.remark,
          created_at: substructure.created_at,
          updated_at: substructure.updated_at,
          created_by_user_id: substructure.created_by_user_id
        };
      } catch (error) {
        logger.error(`Error reading substructure from S3 key ${key}:`, error);
        return null;
      }
    });
    
    const substructureResults = await Promise.all(substructurePromises);
    const substructures = substructureResults
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    logger.info(`[S3 READ ENABLED] listSubstructures count=${substructures.length} ${structureId ? `structure_id=${structureId}` : `project_id=${projectId}`}`);
    
    const response = createResponse(200, {
      success: true,
      message: 'Substructures retrieved successfully',
      data: substructures
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error listing substructures:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve substructures'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 
