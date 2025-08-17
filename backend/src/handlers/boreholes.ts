import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { z } from 'zod';
import * as db from '../db';

// Borehole Schema
const CreateBoreholeSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  structure_id: z.string().uuid('Invalid structure ID'),
  borehole_number: z.string().min(1, 'Borehole number is required'),
  description: z.string().optional(),
  coordinates: z.object({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    elevation: z.number().optional()
  }).optional(),
  status: z.enum(['active', 'completed', 'abandoned']).default('active')
});

const UpdateBoreholeSchema = CreateBoreholeSchema.partial();

export const listBoreholes = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

    // Get all boreholes with project and structure info
    const query = `
      SELECT 
        b.borehole_id,
        b.project_id,
        b.structure_id,
        b.borehole_number,
        b.description,
        b.coordinates,
        b.status,
        b.created_at,
        b.updated_at,
        p.name as project_name,
        s.type as structure_name
      FROM borehole b
      JOIN projects p ON b.project_id = p.project_id
      JOIN structure s ON b.structure_id = s.structure_id
      ORDER BY p.name, s.type, b.borehole_number
    `;

    const result = await db.query(query);

    const response = createResponse(200, {
      success: true,
      message: 'Boreholes retrieved successfully',
      data: result
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error listing boreholes:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve boreholes'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

export const getBoreholeById = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

    const boreholeId = event.pathParameters?.boreholeId;

    if (!boreholeId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing borehole ID',
        error: 'boreholeId is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get borehole by ID
    const query = `
      SELECT 
        b.borehole_id,
        b.project_id,
        b.structure_id,
        b.borehole_number,
        b.description,
        b.coordinates,
        b.status,
        b.created_at,
        b.updated_at,
        p.name as project_name,
        s.type as structure_name
      FROM borehole b
      JOIN projects p ON b.project_id = p.project_id
      JOIN structure s ON b.structure_id = s.structure_id
      WHERE b.borehole_id = $1
    `;

    const result = await db.query(query, [boreholeId]);

    if (result.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Borehole not found',
        error: 'Borehole does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const response = createResponse(200, {
      success: true,
      message: 'Borehole retrieved successfully',
      data: result[0]
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error getting borehole:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve borehole'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

export const getBoreholesByProject = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

    const projectId = event.pathParameters?.projectId;

    if (!projectId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing project ID',
        error: 'projectId is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Check if user has access to the project
    const projectAccessQuery = `
      SELECT 1 FROM user_assignments 
      WHERE user_id = $1 AND project_id = $2
    `;
    const projectAccess = await db.query(projectAccessQuery, [payload.userId, projectId]);
    
    if (projectAccess.length === 0 && payload.role !== 'Admin') {
      const response = createResponse(403, {
        success: false,
        message: 'Access denied: User not assigned to this project',
        error: 'Insufficient permissions'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get boreholes by project
    const query = `
      SELECT 
        b.borehole_id,
        b.project_id,
        b.structure_id,
        b.borehole_number,
        b.description,
        b.coordinates,
        b.status,
        b.created_at,
        b.updated_at,
        s.type as structure_name
      FROM borehole b
      JOIN structure s ON b.structure_id = s.structure_id
      WHERE b.project_id = $1
      ORDER BY s.type, b.borehole_number
    `;

    const result = await db.query(query, [projectId]);

    const response = createResponse(200, {
      success: true,
      message: 'Boreholes retrieved successfully',
      data: result
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error getting boreholes by project:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve boreholes'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

export const getBoreholesByProjectAndStructure = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

    const projectId = event.pathParameters?.projectId;
    const structureId = event.pathParameters?.structureId;

    if (!projectId || !structureId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing project ID or structure ID',
        error: 'Both projectId and structureId are required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Check if user has access to the project
    const projectAccessQuery = `
      SELECT 1 FROM user_assignments 
      WHERE user_id = $1 AND project_id = $2
    `;
    const projectAccess = await db.query(projectAccessQuery, [payload.userId, projectId]);
    
    if (projectAccess.length === 0 && payload.role !== 'Admin') {
      const response = createResponse(403, {
        success: false,
        message: 'Access denied: User not assigned to this project',
        error: 'Insufficient permissions'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get boreholes by project and structure
    const query = `
      SELECT 
        b.borehole_id,
        b.project_id,
        b.structure_id,
        b.borehole_number,
        b.description,
        b.coordinates,
        b.status,
        b.created_at,
        b.updated_at
      FROM borehole b
      WHERE b.project_id = $1 AND b.structure_id = $2
      ORDER BY b.borehole_number
    `;

    const result = await db.query(query, [projectId, structureId]);

    const response = createResponse(200, {
      success: true,
      message: 'Boreholes retrieved successfully',
      data: result
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error getting boreholes by project and structure:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve boreholes'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

export const createBorehole = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager'])(event);
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

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validationResult = CreateBoreholeSchema.safeParse(body);
    
    if (!validationResult.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: validationResult.error.errors
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const boreholeData = validationResult.data;

    // Check if user has access to the project
    const projectAccessQuery = `
      SELECT 1 FROM user_assignments 
      WHERE user_id = $1 AND project_id = $2
    `;
    const projectAccess = await db.query(projectAccessQuery, [payload.userId, boreholeData.project_id]);
    
    if (projectAccess.length === 0 && payload.role !== 'Admin') {
      const response = createResponse(403, {
        success: false,
        message: 'Access denied: User not assigned to this project',
        error: 'Insufficient permissions'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Check if borehole number already exists for this project and structure
    const existingBoreholeQuery = `
      SELECT 1 FROM borehole 
      WHERE project_id = $1 AND structure_id = $2 AND borehole_number = $3
    `;
    const existingBorehole = await db.query(existingBoreholeQuery, [
      boreholeData.project_id,
      boreholeData.structure_id,
      boreholeData.borehole_number
    ]);

    if (existingBorehole.length > 0) {
      const response = createResponse(409, {
        success: false,
        message: 'Borehole number already exists',
        error: 'A borehole with this number already exists for this project and structure'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Insert the borehole
    const insertQuery = `
      INSERT INTO borehole (
        borehole_id,
        project_id,
        structure_id,
        borehole_number,
        description,
        coordinates,
        status,
        created_by_user_id
      ) VALUES (
        gen_random_uuid(),
        $1, $2, $3, $4, $5, $6, $7
      ) RETURNING borehole_id, created_at
    `;

    const insertResult = await db.query(insertQuery, [
      boreholeData.project_id,
      boreholeData.structure_id,
      boreholeData.borehole_number,
      boreholeData.description,
      boreholeData.coordinates ? JSON.stringify(boreholeData.coordinates) : null,
      boreholeData.status,
      payload.userId
    ]);

    const newBorehole = insertResult[0];

    const response = createResponse(201, {
      success: true,
      message: 'Borehole created successfully',
      data: {
        borehole_id: newBorehole.borehole_id,
        created_at: newBorehole.created_at
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error creating borehole:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create borehole'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

export const updateBorehole = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager'])(event);
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

    const boreholeId = event.pathParameters?.boreholeId;

    if (!boreholeId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing borehole ID',
        error: 'boreholeId is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validationResult = UpdateBoreholeSchema.safeParse(body);
    
    if (!validationResult.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: validationResult.error.errors
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const updateData = validationResult.data;

    // Check if borehole exists and user has access
    const boreholeQuery = `
      SELECT b.*, p.name as project_name 
      FROM borehole b
      JOIN projects p ON b.project_id = p.project_id
      WHERE b.borehole_id = $1
    `;
    const boreholeResult = await db.query(boreholeQuery, [boreholeId]);

    if (boreholeResult.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Borehole not found',
        error: 'Borehole does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const borehole = boreholeResult[0];

    // Check if user has access to the project
    const projectAccessQuery = `
      SELECT 1 FROM user_assignments 
      WHERE user_id = $1 AND project_id = $2
    `;
    const projectAccess = await db.query(projectAccessQuery, [payload.userId, borehole.project_id]);
    
    if (projectAccess.length === 0 && payload.role !== 'Admin') {
      const response = createResponse(403, {
        success: false,
        message: 'Access denied: User not assigned to this project',
        error: 'Insufficient permissions'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Check if borehole number already exists (if being updated)
    if (updateData.borehole_number) {
      const existingBoreholeQuery = `
        SELECT 1 FROM borehole 
        WHERE project_id = $1 AND structure_id = $2 AND borehole_number = $3 AND borehole_id != $4
      `;
      const existingBorehole = await db.query(existingBoreholeQuery, [
        borehole.project_id,
        borehole.structure_id,
        updateData.borehole_number,
        boreholeId
      ]);

      if (existingBorehole.length > 0) {
        const response = createResponse(409, {
          success: false,
          message: 'Borehole number already exists',
          error: 'A borehole with this number already exists for this project and structure'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (updateData.borehole_number !== undefined) {
      updateFields.push(`borehole_number = $${paramIndex++}`);
      updateValues.push(updateData.borehole_number);
    }

    if (updateData.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      updateValues.push(updateData.description);
    }

    if (updateData.coordinates !== undefined) {
      updateFields.push(`coordinates = $${paramIndex++}`);
      updateValues.push(updateData.coordinates ? JSON.stringify(updateData.coordinates) : null);
    }

    if (updateData.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(updateData.status);
    }

    if (updateFields.length === 0) {
      const response = createResponse(400, {
        success: false,
        message: 'No fields to update',
        error: 'At least one field must be provided for update'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(boreholeId);

    const updateQuery = `
      UPDATE borehole 
      SET ${updateFields.join(', ')}
      WHERE borehole_id = $${paramIndex}
      RETURNING borehole_id, updated_at
    `;

    const updateResult = await db.query(updateQuery, updateValues);

    const response = createResponse(200, {
      success: true,
      message: 'Borehole updated successfully',
      data: {
        borehole_id: updateResult[0].borehole_id,
        updated_at: updateResult[0].updated_at
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error updating borehole:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to update borehole'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

export const deleteBorehole = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin'])(event);
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

    const boreholeId = event.pathParameters?.boreholeId;

    if (!boreholeId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing borehole ID',
        error: 'boreholeId is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Check if borehole exists
    const boreholeQuery = `
      SELECT borehole_id, project_id FROM borehole WHERE borehole_id = $1
    `;
    const boreholeResult = await db.query(boreholeQuery, [boreholeId]);

    if (boreholeResult.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Borehole not found',
        error: 'Borehole does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Delete the borehole
    const deleteQuery = `
      DELETE FROM borehole WHERE borehole_id = $1
    `;
    await db.query(deleteQuery, [boreholeId]);

    const response = createResponse(200, {
      success: true,
      message: 'Borehole deleted successfully'
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error deleting borehole:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to delete borehole'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};
