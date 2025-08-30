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

    // Get all projects (Site Engineers can see all projects, but will only access assigned borelogs)
    const projectsQuery = `
      SELECT project_id, name, location, created_at
      FROM projects
      ORDER BY name
    `;

    const projects = await db.query(projectsQuery);

    // Get structures for all projects (or filter by project_id if provided)
    const projectId = event.queryStringParameters?.project_id;
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

    // Get substructures for all structures (or filter by structure_id if provided)
    const structureId = event.queryStringParameters?.structure_id;
    let substructuresQuery: string;
    let substructuresParams: any[] = [];

    if (structureId) {
      substructuresQuery = `
        SELECT ss.substructure_id, ss.type, ss.remark, ss.structure_id
        FROM sub_structures ss
        WHERE ss.structure_id = $1
        ORDER BY ss.type
      `;
      substructuresParams = [structureId];
    } else {
      substructuresQuery = `
        SELECT ss.substructure_id, ss.type, ss.remark, ss.structure_id
        FROM sub_structures ss
        ORDER BY ss.structure_id, ss.type
      `;
    }

    const substructures = await db.query(substructuresQuery, substructuresParams);

    // Group structures by project_id
    const structures_by_project: { [key: string]: any[] } = {};
    structures.forEach((structure: any) => {
      if (!structures_by_project[structure.project_id]) {
        structures_by_project[structure.project_id] = [];
      }
      structures_by_project[structure.project_id].push(structure);
    });

    // Group substructures by structure_id
    const substructures_by_structure: { [key: string]: any[] } = {};
    substructures.forEach((substructure: any) => {
      if (!substructures_by_structure[substructure.structure_id]) {
        substructures_by_structure[substructure.structure_id] = [];
      }
      substructures_by_structure[substructure.structure_id].push(substructure);
    });

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


