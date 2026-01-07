import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import * as db from '../db';
import { guardDbRoute } from '../db';
import { createStorageClient } from '../storage/s3Client';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const storageMode = (process.env.STORAGE_MODE || '').toLowerCase();
  const useS3 = storageMode === 's3';

  // Guard: Check if DB is enabled (skip when using S3 mode)
  if (!useS3) {
    const dbGuard = guardDbRoute('getBorelogFormData');
    if (dbGuard) return dbGuard;
  }

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

    const projectId = event.queryStringParameters?.project_id;
    const structureId = event.queryStringParameters?.structure_id;

    let projects: any[] = [];
    let structures_by_project: { [key: string]: any[] } = {};
    let substructures_by_structure: { [key: string]: any[] } = {};

    if (useS3) {
      const storage = createStorageClient();

      // Projects
      const projectKeys = (await storage.listFiles('projects/', 10000))
        .filter(k => k.endsWith('/project.json'));
      const projectBuffers = await Promise.all(projectKeys.map(k => storage.downloadFile(k).then(b => ({ k, b })).catch(() => null)));
      projects = projectBuffers
        .filter((p): p is { k: string; b: Buffer } => !!p)
        .map(p => JSON.parse(p.b.toString('utf-8')))
        .map(p => ({
          project_id: p.project_id || p.id,
          name: p.name,
          location: p.location || null,
          created_at: p.created_at,
        }));

      // Structures
      const structureKeys = (await storage.listFiles('projects/', 20000))
        .filter(k => k.endsWith('/structure.json'))
        .filter(k => !projectId || k.includes(`project_${projectId}/`));
      const structureBuffers = await Promise.all(structureKeys.map(k => storage.downloadFile(k).then(b => ({ k, b })).catch(() => null)));
      structureBuffers
        .filter((p): p is { k: string; b: Buffer } => !!p)
        .forEach(p => {
          const s = JSON.parse(p.b.toString('utf-8'));
          const pid = s.project_id;
          if (!structures_by_project[pid]) structures_by_project[pid] = [];
          structures_by_project[pid].push({
            structure_id: s.structure_id,
            type: s.type,
            description: s.description,
            project_id: s.project_id,
          });
        });

      // Substructures
      const substructureKeys = (await storage.listFiles('projects/', 30000))
        .filter(k => k.endsWith('/substructure.json'))
        .filter(k => !structureId || k.includes(`structure_${structureId}/`));
      const substructureBuffers = await Promise.all(substructureKeys.map(k => storage.downloadFile(k).then(b => ({ k, b })).catch(() => null)));
      substructureBuffers
        .filter((p): p is { k: string; b: Buffer } => !!p)
        .forEach(p => {
          const ss = JSON.parse(p.b.toString('utf-8'));
          const sid = ss.structure_id;
          if (!substructures_by_structure[sid]) substructures_by_structure[sid] = [];
          substructures_by_structure[sid].push({
            substructure_id: ss.substructure_id,
            type: ss.type,
            remark: ss.remark,
            structure_id: ss.structure_id,
          });
        });
    } else {
      // DB path (existing behavior)
      const projectsQuery = `
        SELECT project_id, name, location, created_at
        FROM projects
        ORDER BY name
      `;

      projects = await db.query(projectsQuery);

      let structuresQuery: string;
      let structuresParams: any[] = [];

      if (projectId) {
        structuresQuery = `
          SELECT s.structure_id, s.type, s.description, s.project_id
          FROM structure s
          WHERE s.project_id = $1
          ORDER BY s.type
        `;
        structuresParams = [projectId];
      } else {
        structuresQuery = `
          SELECT s.structure_id, s.type, s.description, s.project_id
          FROM structure s
          ORDER BY s.project_id, s.type
        `;
      }

      const structures = await db.query(structuresQuery, structuresParams);

      const structureIdParam = event.queryStringParameters?.structure_id;
      let substructuresQuery: string;
      let substructuresParams: any[] = [];

      if (structureIdParam) {
        substructuresQuery = `
          SELECT ss.substructure_id, ss.type, ss.remark, ss.structure_id
          FROM sub_structures ss
          WHERE ss.structure_id = $1
          ORDER BY ss.type
        `;
        substructuresParams = [structureIdParam];
      } else {
        substructuresQuery = `
          SELECT ss.substructure_id, ss.type, ss.remark, ss.structure_id
          FROM sub_structures ss
          ORDER BY ss.structure_id, ss.type
        `;
      }

      const substructures = await db.query(substructuresQuery, substructuresParams);

      // Group structures by project_id
      structures.forEach((structure: any) => {
        if (!structures_by_project[structure.project_id]) {
          structures_by_project[structure.project_id] = [];
        }
        structures_by_project[structure.project_id].push(structure);
      });

      // Group substructures by structure_id
      substructures.forEach((substructure: any) => {
        if (!substructures_by_structure[substructure.structure_id]) {
          substructures_by_structure[substructure.structure_id] = [];
        }
        substructures_by_structure[substructure.structure_id].push(substructure);
      });
    }

    const response = createResponse(200, {
      success: true,
      message: 'Form data retrieved successfully',
      data: {
        projects,
        structures_by_project,
        substructures_by_structure
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error retrieving form data:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve form data'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};


