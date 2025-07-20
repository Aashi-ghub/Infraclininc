import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole } from '../utils/validateInput';
import { logger } from '../utils/logger';
import { query } from '../db';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Validation schemas
const TeamAssignmentSchema = z.object({
  project_id: z.string().uuid(),
  user_ids: z.array(z.string().uuid()),
  assignment_type: z.enum(['ManagerToTeam'])
});

// Project Manager Handlers
export const assignTeamMembers = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authError = checkRole(['Project Manager'])(event);
    if (authError) return authError;

    const body = JSON.parse(event.body || '{}');
    const validationResult = TeamAssignmentSchema.safeParse(body);

    if (!validationResult.success) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'Validation error',
          errors: validationResult.error.errors,
          status: 'error'
        })
      };
    }

    const assignmentData = validationResult.data;
    const managerId = event.user?.userId;

    // Verify project exists and manager has access
    const projectAccess = await query(
      'SELECT * FROM user_project_assignments WHERE project_id = $1 AND $2 = ANY(assignee) AND assignment_type = $3',
      [assignmentData.project_id, managerId, 'AdminToManager']
    );

    if (projectAccess.length === 0) {
      return {
        statusCode: 403,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'You do not have permission to manage this project',
          status: 'error'
        })
      };
    }

    // Create team assignments
    const assignmentId = uuidv4();
    await query(
      'INSERT INTO user_project_assignments (id, project_id, assignment_type, assigner, assignee, created_by_user_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        assignmentId,
        assignmentData.project_id,
        assignmentData.assignment_type,
        [managerId],
        assignmentData.user_ids,
        managerId
      ]
    );

    return {
      statusCode: 201,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Team members assigned successfully',
        data: { assignment_id: assignmentId },
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error assigning team members:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Internal server error',
        status: 'error'
      })
    };
  }
};

export const getProjectTeam = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authError = checkRole(['Project Manager'])(event);
    if (authError) return authError;

    const projectId = event.pathParameters?.projectId;
    if (!projectId) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'Project ID is required',
          status: 'error'
        })
      };
    }

    // Get all team members for the project
    const teamMembers = await query(
      `SELECT u.* 
       FROM users u
       INNER JOIN user_project_assignments upa ON u.user_id = ANY(upa.assignee)
       WHERE upa.project_id = $1 AND upa.assignment_type = 'ManagerToTeam'`,
      [projectId]
    );

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Team members retrieved successfully',
        data: teamMembers,
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error getting project team:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Internal server error',
        status: 'error'
      })
    };
  }
};

export const getManagerProjects = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authError = checkRole(['Project Manager'])(event);
    if (authError) return authError;

    const managerId = event.user?.userId;

    // Get all projects where the user is assigned as a manager
    const projects = await query(
      `SELECT p.* 
       FROM projects p
       INNER JOIN user_project_assignments upa ON p.project_id = upa.project_id
       WHERE $1 = ANY(upa.assignee) AND upa.assignment_type = 'AdminToManager'
       ORDER BY p.created_at DESC`,
      [managerId]
    );

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Projects retrieved successfully',
        data: projects,
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error getting manager projects:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Internal server error',
        status: 'error'
      })
    };
  }
}; 