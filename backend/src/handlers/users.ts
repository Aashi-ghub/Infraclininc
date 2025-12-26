import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import * as db from '../db';
import { guardDbRoute } from '../db';

interface User {
  user_id: string;
  name: string;
  email: string;
  role: string;
  organisation_id?: string;
  customer_id?: string;
  created_at: Date;
}

export const listUsers = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('listUsers');
  if (dbGuard) return dbGuard;

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Allow Admin and Project Manager to list users
    const authError = await checkRole(['Admin', 'Project Manager'])(event);
    if (authError) {
      return authError;
    }

    // Query users from database
    const rows = await db.query<User>(
      `SELECT 
        user_id,
        name,
        email,
        role,
        organisation_id,
        customer_id,
        created_at
      FROM users
      ORDER BY name ASC`
    );

    const users = rows.map(user => ({
      ...user,
      created_at: new Date(user.created_at)
    }));

    const response = createResponse(200, {
      success: true,
      message: 'Users retrieved successfully',
      data: users
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error retrieving users:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve users'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

export const getLabEngineers = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('getLabEngineers');
  if (dbGuard) return dbGuard;

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Allow Admin and Project Manager to get lab engineers
    const authError = await checkRole(['Admin', 'Project Manager'])(event);
    if (authError) {
      return authError;
    }

    // Query lab engineers from database
    const rows = await db.query<User>(
      `SELECT 
        user_id,
        name,
        email,
        role,
        organisation_id,
        customer_id,
        created_at
      FROM users
      WHERE role = 'Lab Engineer'
      ORDER BY name ASC`
    );

    const labEngineers = rows.map(user => ({
      ...user,
      created_at: new Date(user.created_at)
    }));

    const response = createResponse(200, {
      success: true,
      message: 'Lab engineers retrieved successfully',
      data: labEngineers
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error retrieving lab engineers:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve lab engineers'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

export const getUserById = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('getUserById');
  if (dbGuard) return dbGuard;

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Only Admin can get user details
    const authError = await checkRole(['Admin'])(event);
    if (authError) {
      return authError;
    }

    const userId = event.pathParameters?.user_id;
    if (!userId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing user ID',
        error: 'User ID is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Query user from database
    const rows = await db.query<User>(
      `SELECT 
        user_id,
        name,
        email,
        role,
        organisation_id,
        customer_id,
        created_at
      FROM users
      WHERE user_id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'User not found',
        error: 'No user exists with the provided ID'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const user = {
      ...rows[0],
      created_at: new Date(rows[0].created_at)
    };

    const response = createResponse(200, {
      success: true,
      message: 'User retrieved successfully',
      data: user
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error retrieving user:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve user'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};
