import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { validateToken } from './validateInput';
import { createResponse } from '../types/common';
import { logger } from './logger';
import * as db from '../db';

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

      // Extract project ID from request
      let projectId: string | undefined;
      
      // Try to get project ID from path parameters
      if (event.pathParameters?.projectId) {
        projectId = event.pathParameters.projectId;
      } else if (event.pathParameters?.project_id) {
        projectId = event.pathParameters.project_id;
      } else if (event.pathParameters?.projectName) {
        // For project name-based endpoints, we'll need to look it up
        const projectName = decodeURIComponent(event.pathParameters.projectName);
        const projectQuery = `SELECT project_id FROM projects WHERE name = $1`;
        const projectResult = await db.query(projectQuery, [projectName]);
        if (projectResult.length > 0) {
          projectId = (projectResult[0] as any).project_id;
        }
      }

      // If no project ID found, return error
      if (!projectId) {
        return createResponse(400, {
          success: false,
          message: 'Missing project ID',
          error: 'Could not determine project ID from request'
        });
      }

      // Check if user has access to the project
      const projectAccessQuery = `
        SELECT 1 FROM user_project_assignments 
        WHERE project_id = $1 AND $2 = ANY(assignee)
      `;
      const projectAccess = await db.query(projectAccessQuery, [projectId, payload.userId]);
      
      if (projectAccess.length === 0 && payload.role !== 'Admin') {
        return createResponse(403, {
          success: false,
          message: 'Access denied: User not assigned to this project',
          error: 'Insufficient permissions'
        });
      }

      // For site engineers, check borelog assignment if required
      if (options.requireAssignment && payload.role === 'Site Engineer') {
        const borelogId = event.pathParameters?.borelog_id || event.pathParameters?.borelogId;
        const substructureId = event.pathParameters?.substructure_id || event.pathParameters?.substructureId;
        
        if (borelogId || substructureId) {
          const assignmentCheckQuery = `
            SELECT 1 FROM borelog_assignments 
            WHERE assigned_site_engineer = $1 
            AND status = 'active'
            AND (
              ${borelogId ? 'borelog_id = $2' : 'substructure_id = $2'}
            )
          `;
          const assignmentCheck = await db.query(assignmentCheckQuery, [payload.userId, borelogId || substructureId]);
          
          if (assignmentCheck.length === 0) {
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
    if (!borelogId && !substructureId) {
      return false;
    }

    const assignmentQuery = `
      SELECT 1 FROM borelog_assignments 
      WHERE assigned_site_engineer = $1 
      AND status = 'active'
      AND (
        ${borelogId ? 'borelog_id = $2' : 'substructure_id = $2'}
      )
    `;
    
    const assignment = await db.query(assignmentQuery, [userId, borelogId || substructureId]);
    return assignment.length > 0;
  } catch (error) {
    logger.error('Error checking borelog assignment:', error);
      return false;
    }
};

// Function to get assigned borelogs for a site engineer
export const getAssignedBorelogsForSiteEngineer = async (userId: string): Promise<string[]> => {
  try {
    const query = `
      SELECT DISTINCT 
        COALESCE(ba.borelog_id, b.borelog_id) as borelog_id
      FROM borelog_assignments ba
      LEFT JOIN boreloge b ON ba.substructure_id = b.substructure_id
      WHERE ba.assigned_site_engineer = $1 
      AND ba.status = 'active'
    `;
    
    const result = await db.query(query, [userId]);
    return result.map((row: any) => row.borelog_id).filter(Boolean);
  } catch (error) {
    logger.error('Error getting assigned borelogs for site engineer:', error);
    return [];
  }
};

// Function to get assigned substructures for a site engineer
export const getAssignedSubstructuresForSiteEngineer = async (userId: string): Promise<string[]> => {
  try {
    const query = `
      SELECT DISTINCT substructure_id
      FROM borelog_assignments 
      WHERE assigned_site_engineer = $1 
      AND status = 'active'
      AND substructure_id IS NOT NULL
    `;
    
    const result = await db.query(query, [userId]);
    return result.map((row: any) => row.substructure_id);
  } catch (error) {
    logger.error('Error getting assigned substructures for site engineer:', error);
    return [];
  }
}; 

// Function to get projects for site engineers based on their borelog assignments
export const getProjectsForSiteEngineer = async (userId: string): Promise<any[]> => {
  try {
    const query = `
      SELECT DISTINCT 
        p.project_id,
        p.name,
        p.location,
        p.created_at,
        COUNT(DISTINCT ba.assignment_id) as assignment_count
      FROM projects p
      JOIN boreloge b ON p.project_id = b.project_id
      JOIN borelog_assignments ba ON (
        ba.borelog_id = b.borelog_id OR 
        ba.substructure_id = b.substructure_id
      )
      WHERE ba.assigned_site_engineer = $1 
      AND ba.status = 'active'
      GROUP BY p.project_id, p.name, p.location, p.created_at
      ORDER BY p.name
    `;
    
    const result = await db.query(query, [userId]);
    return result;
  } catch (error) {
    logger.error('Error getting projects for site engineer:', error);
    return [];
  }
};

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