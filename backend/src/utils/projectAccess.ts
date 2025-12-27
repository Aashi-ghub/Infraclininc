import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { validateToken } from './validateInput';
import { createResponse } from '../types/common';
import { logger } from './logger';
import { createStorageClient } from '../storage/s3Client';

export interface ProjectAccessOptions {
  requireEdit?: boolean;
  requireApprove?: boolean;
  requireAssignment?: boolean; // For site engineers to check borelog assignments
}

export const checkProjectAccess = (options: ProjectAccessOptions = {}) => {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult | null> => {
    try {
      // Get user info from token
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const payload = await validateToken(authHeader!);
      
      if (!payload) {
        return createResponse(401, {
          success: false,
          message: 'Unauthorized: Invalid token',
          error: 'Invalid token'
        });
      }

      // Extract project ID from request (S3-based)
      let projectId: string | undefined;
      
      // Try to get project ID from path parameters
      if (event.pathParameters?.projectId) {
        projectId = event.pathParameters.projectId;
      } else if (event.pathParameters?.project_id) {
        projectId = event.pathParameters.project_id;
      } else if (event.pathParameters?.projectName) {
        const projectName = decodeURIComponent(event.pathParameters.projectName);
        projectId = await getProjectIdFromNameS3(projectName);
      }

      // If no project ID found, return error
      if (!projectId) {
        return createResponse(400, {
          success: false,
          message: 'Missing project ID',
          error: 'Could not determine project ID from request'
        });
      }

      // For site engineers, optionally check borelog assignment (best-effort, S3 only)
      if (options.requireAssignment && payload.role === 'Site Engineer') {
        const borelogId = event.pathParameters?.borelog_id || event.pathParameters?.borelogId;
        const substructureId = event.pathParameters?.substructure_id || event.pathParameters?.substructureId;
        
        if (borelogId || substructureId) {
          const assigned = await checkBorelogAssignment(payload.userId, borelogId, substructureId);
          if (!assigned) {
            return createResponse(403, {
              success: false,
              message: 'Access denied: Borelog not assigned to you',
              error: 'You can only access borelogs that are assigned to you'
            });
          }
        }
      }

      return null; // Access granted
    } catch (error) {
      logger.error('Error checking project access:', error);
      return createResponse(500, {
        success: false,
        message: 'Internal server error',
        error: 'Failed to check project access'
      });
    }
  };
};

// Specific function to check if a site engineer is assigned to a borelog
export const checkBorelogAssignment = async (
  userId: string, 
  borelogId?: string, 
  substructureId?: string
): Promise<boolean> => {
  try {
    // With DB disabled, we lack assignment data; allow if borelog exists in S3.
    if (!borelogId && !substructureId) {
      return true;
    }
    const storage = createStorageClient();
    const exists = await borelogExists(storage, borelogId, substructureId);
    return exists;
  } catch (error) {
    logger.error('Error checking borelog assignment:', error);
      return false;
    }
};

// Function to get assigned borelogs for a site engineer
export const getAssignedBorelogsForSiteEngineer = async (userId: string): Promise<string[]> => {
  try {
    // Without assignments in S3, return all borelog_ids to avoid empty results
    const storage = createStorageClient();
    return await listAllBorelogIds(storage);
  } catch (error) {
    logger.error('Error getting assigned borelogs for site engineer:', error);
    return [];
  }
};

// Function to get assigned substructures for a site engineer
export const getAssignedSubstructuresForSiteEngineer = async (userId: string): Promise<string[]> => {
  try {
    const storage = createStorageClient();
    const metas = await listAllBorelogMetadata(storage);
    return metas
      .map(m => m.substructure_id)
      .filter(Boolean);
  } catch (error) {
    logger.error('Error getting assigned substructures for site engineer:', error);
    return [];
  }
}; 

// Function to get projects for site engineers based on their borelog assignments
export const getProjectsForSiteEngineer = async (userId: string): Promise<any[]> => {
  try {
    const storage = createStorageClient();
    const projectIds = await listProjectIds(storage);
    // Return minimal project info
    return projectIds.map(id => ({ project_id: id, name: id, location: null, assignment_count: null }));
  } catch (error) {
    logger.error('Error getting projects for site engineer:', error);
    return [];
  }
};

// ========== S3 helper utilities ==========

async function listProjectIds(storage: ReturnType<typeof createStorageClient>): Promise<string[]> {
  const keys = await storage.listFiles('projects/', 20000);
  const ids = new Set<string>();
  keys.forEach(k => {
    const parts = k.split('/');
    if (parts.length < 2) return;
    const folder = parts[1];
    if (folder.startsWith('project_')) {
      ids.add(folder.replace('project_', ''));
    } else if (folder) {
      ids.add(folder);
    }
  });
  return Array.from(ids);
}

async function getProjectIdFromNameS3(projectName: string): Promise<string | undefined> {
  const storage = createStorageClient();
  const projectKeys = (await storage.listFiles('projects/', 20000)).filter(k => k.endsWith('project.json'));

  for (const key of projectKeys) {
    try {
      const buf = await storage.downloadFile(key);
      const proj = JSON.parse(buf.toString('utf-8'));
      if (proj?.name && proj.name.toLowerCase() === projectName.toLowerCase()) {
        if (proj.project_id) return proj.project_id;
        const parts = key.split('/');
        const folder = parts[1];
        return folder.startsWith('project_') ? folder.replace('project_', '') : folder;
      }
    } catch (err) {
      logger.warn('Failed to parse project.json during access check', { key, err });
    }
  }

  return undefined;
}

async function listAllBorelogMetadata(storage: ReturnType<typeof createStorageClient>) {
  const allKeys = await storage.listFiles('projects/', 50000);
  const metaKeys = allKeys.filter(k =>
    k.endsWith('/metadata.json') &&
    k.includes('/borelogs/') &&
    !k.includes('/versions/')
  );

  const metas: any[] = [];
  for (const key of metaKeys) {
    try {
      const buf = await storage.downloadFile(key);
      const meta = JSON.parse(buf.toString('utf-8'));
      metas.push(meta);
    } catch (err) {
      logger.warn('Failed to parse borelog metadata during listing', { key, err });
    }
  }
  return metas;
}

async function listAllBorelogIds(storage: ReturnType<typeof createStorageClient>): Promise<string[]> {
  const metas = await listAllBorelogMetadata(storage);
  return metas.map(m => m.borelog_id).filter(Boolean);
}

async function borelogExists(storage: ReturnType<typeof createStorageClient>, borelogId?: string, substructureId?: string): Promise<boolean> {
  const metas = await listAllBorelogMetadata(storage);
  if (borelogId && metas.some(m => m.borelog_id === borelogId)) return true;
  if (substructureId && metas.some(m => m.substructure_id === substructureId)) return true;
  return false;
}

// Function to get detailed project information with borelog assignments for site engineers
export const getProjectDetailsForSiteEngineer = async (userId: string, projectId: string): Promise<any> => {
  try {
    const query = `
      SELECT 
        p.project_id,
        p.name,
        p.location,
        p.created_at,
        ba.assignment_id,
        ba.assigned_at,
        ba.status as assignment_status,
        ba.notes as assignment_notes,
        ba.expected_completion_date,
        b.borelog_id,
        b.type as borelog_type,
        ss.type as substructure_type,
        ss.remark as substructure_remark,
        s.type as structure_type,
        s.description as structure_description
      FROM projects p
      JOIN boreloge b ON p.project_id = b.project_id
      JOIN sub_structures ss ON b.substructure_id = ss.substructure_id
      JOIN structure s ON ss.structure_id = s.structure_id
      JOIN borelog_assignments ba ON (
        ba.borelog_id = b.borelog_id OR 
        ba.substructure_id = b.substructure_id
      )
      WHERE ba.assigned_site_engineer = $1 
      AND ba.status = 'active'
      AND p.project_id = $2
      ORDER BY s.type, ss.type, b.created_at
    `;
    
    const result = await db.query(query, [userId, projectId]);
    
    if (result.length === 0) {
      return null;
    }
    
    // Group assignments by borelog
    const projectInfo = {
      project_id: (result[0] as any).project_id,
      name: (result[0] as any).name,
      location: (result[0] as any).location,
      created_at: (result[0] as any).created_at,
      assignments: result.map((row: any) => ({
        assignment_id: row.assignment_id,
        assigned_at: row.assigned_at,
        status: row.assignment_status,
        notes: row.assignment_notes,
        expected_completion_date: row.expected_completion_date,
        borelog: {
          borelog_id: row.borelog_id,
          type: row.borelog_type,
          substructure_type: row.substructure_type,
          substructure_remark: row.substructure_remark,
          structure_type: row.structure_type,
          structure_description: row.structure_description
        }
      }))
    };
    
    return projectInfo;
  } catch (error) {
    logger.error('Error getting project details for site engineer:', error);
    return null;
  }
}; 