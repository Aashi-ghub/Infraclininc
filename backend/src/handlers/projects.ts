import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole } from '../utils/validateInput';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db';
import { z } from 'zod';

// Project creation schema
const ProjectSchema = z.object({
  name: z.string().min(3, 'Project name must be at least 3 characters'),
  location: z.string().optional(),
  description: z.string().optional()
});

// Create project handler
export const createProject = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role (only Admin and Project Manager can create projects)
    const authError = checkRole(['Admin', 'Project Manager'])(event);
    if (authError) {
      return authError;
    }

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validationResult = ProjectSchema.safeParse(body);
    
    if (!validationResult.success) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Validation error',
          errors: validationResult.error.errors,
          status: 'error'
        })
      };
    }

    const projectData = validationResult.data;
    const projectId = uuidv4();
    const userId = event.user?.userId; // Added by checkRole middleware

    // Create project in database
    const result = await query(
      'INSERT INTO projects (project_id, name, location, created_by_user_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [projectId, projectData.name, projectData.location || null, userId]
    );

    // Create initial project assignment for the creator
    await query(
      'INSERT INTO user_project_assignments (project_id, assignment_type, assigner, assignee, created_by_user_id) VALUES ($1, $2, $3, $4, $5)',
      [
        projectId,
        'AdminToManager',
        [userId],
        [userId],
        userId
      ]
    );

    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Project created successfully',
        data: result[0],
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error creating project:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Internal server error',
        status: 'error'
      })
    };
  }
};

// Mock data for projects
const mockProjects = [
  {
    id: 'p-001',
    name: 'Highway Expansion Project',
    client: 'Department of Transportation',
    location: 'Delhi-NCR',
    start_date: '2023-01-15',
    end_date: '2024-06-30',
    status: 'active',
    description: 'Expansion of national highway from 4 lanes to 6 lanes'
  },
  {
    id: 'p-002',
    name: 'Metro Rail Construction',
    client: 'Metro Rail Corporation',
    location: 'Mumbai',
    start_date: '2023-03-01',
    end_date: '2025-12-31',
    status: 'active',
    description: 'Construction of new metro rail line connecting east and west corridors'
  },
  {
    id: 'p-003',
    name: 'Bridge Foundation Survey',
    client: 'National Highways Authority',
    location: 'Chennai',
    start_date: '2023-02-10',
    end_date: '2023-08-15',
    status: 'completed',
    description: 'Geological survey for new bridge foundation'
  },
  {
    id: 'p-004',
    name: 'Test Project',
    client: 'Research Institute',
    location: 'Bangalore',
    start_date: '2023-05-01',
    status: 'active',
    description: 'Testing of new construction materials'
  },
  {
    id: 'p-005',
    name: 'Delhi Metro Phase 4',
    client: 'Delhi Metro Rail Corporation',
    location: 'Delhi',
    start_date: '2023-04-15',
    end_date: '2026-03-31',
    status: 'active',
    description: 'Extension of metro network to outer Delhi regions'
  },
  {
    id: 'p-006',
    name: 'Direct Test Project',
    client: 'Direct Construction Ltd.',
    location: 'Hyderabad',
    start_date: '2023-06-01',
    status: 'on-hold',
    description: 'Testing of direct foundation techniques'
  }
];

export const listProjects = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = checkRole(['Admin', 'Engineer', 'Logger', 'Viewer'])(event);
    if (authError) {
      return authError;
    }
    
    // In a real implementation, you would fetch from database
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Projects retrieved successfully',
        data: mockProjects,
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error listing projects:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Internal server error',
        status: 'error'
      })
    };
  }
}; 