import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { getProjectsForSiteEngineer, getProjectDetailsForSiteEngineer } from '../utils/projectAccess';
import { validate as validateUUID } from 'uuid';
import { createStorageClient } from '../storage/s3Client';
import * as fs from 'fs/promises';
import * as path from 'path';

export const listProjects = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

    let projects;

    if (payload.role === 'Site Engineer') {
      // For Site Engineers, get projects with assignment counts (still uses DB)
      projects = await getProjectsForSiteEngineer(payload.userId);
    } else {
      // For other roles, get all projects from S3
      const storageClient = createStorageClient();
      
      let projectJsonKeys: string[] = [];
      
      const storageMode = (process.env.STORAGE_MODE || '').toLowerCase();
      const isOffline = storageMode !== 's3' && process.env.IS_OFFLINE === 'true';

      // Handle local filesystem mode (offline) differently
      if (isOffline) {
        // For local filesystem, manually traverse directories
        const localStoragePath = process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), 'local-storage');
        const projectsDir = path.join(localStoragePath, 'projects');
        
        try {
          const entries = await fs.readdir(projectsDir, { withFileTypes: true });
          
          for (const entry of entries) {
            if (entry.isDirectory() && entry.name.startsWith('project_')) {
              const projectJsonPath = path.join(projectsDir, entry.name, 'project.json');
              try {
                await fs.access(projectJsonPath);
                // Convert to S3 key format: projects/project_<id>/project.json
                projectJsonKeys.push(`projects/${entry.name}/project.json`);
              } catch {
                // File doesn't exist, skip
                continue;
              }
            }
          }
        } catch (error: any) {
          // Directory might not exist yet, that's okay
          if (error.code !== 'ENOENT') {
            logger.error('Error listing local project directories:', error);
          }
        }
      } else {
        // For S3, use listFiles which handles recursive listing
        const projectKeys = await storageClient.listFiles('projects/', 10000);
        
        // Filter to only project.json files matching the pattern
        projectJsonKeys = projectKeys.filter(key => {
          // Match pattern: projects/project_<uuid>/project.json
          return key.match(/^projects\/project_[^\/]+\/project\.json$/) !== null;
        });
      }
      
      // Read and parse each project.json
      const projectPromises = projectJsonKeys.map(async (key) => {
        try {
          const projectBuffer = await storageClient.downloadFile(key);
          const project = JSON.parse(projectBuffer.toString('utf-8'));
          
          // Return in the exact same format as DB query
          return {
            project_id: project.project_id || project.id,
            name: project.name,
            location: project.location || null,
            created_at: project.created_at,
            assignment_count: 0
          };
        } catch (error) {
          logger.error(`Error reading project from S3 key ${key}:`, error);
          return null;
        }
      });
      
      const projectResults = await Promise.all(projectPromises);
      projects = projectResults
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    // Log with count
    logger.info(`[S3 READ ENABLED] listProjects count=${projects.length}`);

    const response = createResponse(200, {
      success: true,
      message: 'Projects retrieved successfully',
      data: projects
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error retrieving projects:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve projects'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

export const getProject = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

    const projectId = event.pathParameters?.project_id;
    if (!projectId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing project_id parameter',
        error: 'project_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    if (!validateUUID(projectId)) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid project_id format',
        error: 'project_id must be a valid UUID'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    let project;

    if (payload.role === 'Site Engineer') {
      // For Site Engineers, get project with assignment details (still uses DB)
      project = await getProjectDetailsForSiteEngineer(payload.userId, projectId);
      
      if (!project) {
        const response = createResponse(404, {
          success: false,
          message: 'Project not found or no assignments for this project',
          error: 'Project with the specified ID does not exist or you have no assignments in this project'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
    } else {
      // For other roles, get project details from S3
      const storageClient = createStorageClient();
      const s3Key = `projects/project_${projectId}/project.json`;
      
      try {
        const projectBuffer = await storageClient.downloadFile(s3Key);
        const projectData = JSON.parse(projectBuffer.toString('utf-8'));
        
        // Return in the same format as DB query
        project = {
          project_id: projectData.project_id || projectData.id,
          name: projectData.name,
          location: projectData.location || null,
          created_at: projectData.created_at
        };
      } catch (error: any) {
        // Check if it's a "not found" error
        if (error.message?.includes('Failed to download') || error.message?.includes('ENOENT')) {
          const response = createResponse(404, {
            success: false,
            message: 'Project not found',
            error: 'Project with the specified ID does not exist'
          });
          logResponse(response, Date.now() - startTime);
          return response;
        }
        throw error;
      }
    }

    const response = createResponse(200, {
      success: true,
      message: 'Project retrieved successfully',
      data: project
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error retrieving project:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve project'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 
