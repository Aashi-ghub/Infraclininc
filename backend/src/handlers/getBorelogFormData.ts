import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import * as db from '../db';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = checkRole(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer'])(event);
    if (authError) {
      return authError;
    }

    // Get user info from token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = validateToken(authHeader!);
    if (!payload) {
      const response = createResponse(401, {
        success: false,
        message: 'Unauthorized: Invalid token',
        error: 'Invalid token'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get projects based on user role and assignments
    let projectsQuery: string;
    let projectsParams: any[] = [];

    if (payload.role === 'Site Engineer') {
      // Site Engineers can only see assigned projects
      projectsQuery = `
        SELECT DISTINCT p.project_id, p.name, p.location, p.created_at
        FROM projects p
        JOIN user_project_assignments upa ON p.project_id = upa.project_id
        WHERE $1 = ANY(upa.assignee)
        ORDER BY p.name
      `;
      projectsParams = [payload.userId];
    } else {
      // Admin, Project Manager, etc. can see all projects
      projectsQuery = `
        SELECT project_id, name, location, created_at
        FROM projects
        ORDER BY name
      `;
    }

    const projects = await db.query(projectsQuery, projectsParams);

    // Get structures for all projects (or filter by project_id if provided)
    const projectId = event.queryStringParameters?.project_id;
    let structuresQuery: string;
    let structuresParams: any[] = [];

    if (projectId) {
      structuresQuery = `
        SELECT s.structure_id, s.type, s.description, s.project_id, s.created_at
        FROM structure s
        WHERE s.project_id = $1
        ORDER BY s.type, s.description
      `;
      structuresParams = [projectId];
    } else {
      structuresQuery = `
        SELECT s.structure_id, s.type, s.description, s.project_id, s.created_at
        FROM structure s
        ORDER BY s.project_id, s.type, s.description
      `;
    }

    const structures = await db.query(structuresQuery, structuresParams);

    // Get substructures (filter by structure_id if provided)
    const structureId = event.queryStringParameters?.structure_id;
    let substructuresQuery: string;
    let substructuresParams: any[] = [];

    if (structureId) {
      substructuresQuery = `
        SELECT ss.substructure_id, ss.type, ss.remark, ss.structure_id, ss.project_id, ss.created_at
        FROM sub_structures ss
        WHERE ss.structure_id = $1
        ORDER BY ss.type
      `;
      substructuresParams = [structureId];
    } else if (projectId) {
      substructuresQuery = `
        SELECT ss.substructure_id, ss.type, ss.remark, ss.structure_id, ss.project_id, ss.created_at
        FROM sub_structures ss
        WHERE ss.project_id = $1
        ORDER BY ss.structure_id, ss.type
      `;
      substructuresParams = [projectId];
    } else {
      substructuresQuery = `
        SELECT ss.substructure_id, ss.type, ss.remark, ss.structure_id, ss.project_id, ss.created_at
        FROM sub_structures ss
        ORDER BY ss.project_id, ss.structure_id, ss.type
      `;
    }

    const substructures = await db.query(substructuresQuery, substructuresParams);

    // Group structures by project
    const structuresByProject = structures.reduce((acc, structure) => {
      if (!acc[structure.project_id]) {
        acc[structure.project_id] = [];
      }
      acc[structure.project_id].push({
        structure_id: structure.structure_id,
        type: structure.type,
        description: structure.description,
        created_at: structure.created_at
      });
      return acc;
    }, {} as Record<string, any[]>);

    // Group substructures by structure
    const substructuresByStructure = substructures.reduce((acc, substructure) => {
      if (!acc[substructure.structure_id]) {
        acc[substructure.structure_id] = [];
      }
      acc[substructure.structure_id].push({
        substructure_id: substructure.substructure_id,
        type: substructure.type,
        remark: substructure.remark,
        project_id: substructure.project_id,
        created_at: substructure.created_at
      });
      return acc;
    }, {} as Record<string, any[]>);

    const response = createResponse(200, {
      success: true,
      message: 'Form data retrieved successfully',
      data: {
        projects: projects.map(p => ({
          project_id: p.project_id,
          name: p.name,
          location: p.location,
          created_at: p.created_at
        })),
        structures_by_project: structuresByProject,
        substructures_by_structure: substructuresByStructure
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


