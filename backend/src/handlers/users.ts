import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import * as userStore from '../auth/userStore';
import * as authService from '../auth/authService';
import { z } from 'zod';
import { parseBody } from '../utils/parseBody';

/**
 * MIGRATED: This handler now reads from S3 instead of database
 * Uses userStore which reads from S3: users/users.json
 */

interface User {
  user_id: string;
  name: string;
  email: string;
  role: string;
  organisation_id?: string;
  customer_id?: string;
  created_at: Date | string;
}

// Schema for creating user
const CreateUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer'] as const),
  organisation_id: z.string().uuid('Invalid organisation ID').optional(),
  customer_id: z.string().uuid('Invalid customer ID').optional()
});

export const listUsers = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // MIGRATED: Removed DB guard - now S3-only
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Allow Admin and Project Manager to list users
    const authError = await checkRole(['Admin', 'Project Manager'])(event);
    if (authError) {
      return authError;
    }

    // Read users from S3 via userStore
    const allUsers = await userStore.getAllUsers();
    
    // Transform to match expected format
    const users: User[] = allUsers.map(user => ({
      user_id: user.user_id || user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organisation_id: user.organisation_id,
      customer_id: user.customer_id,
      created_at: user.created_at ? new Date(user.created_at) : new Date()
    }));

    // Sort by name
    users.sort((a, b) => a.name.localeCompare(b.name));

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
  // MIGRATED: Removed DB guard - now S3-only
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Allow Admin and Project Manager to get lab engineers
    const authError = await checkRole(['Admin', 'Project Manager'])(event);
    if (authError) {
      return authError;
    }

    // Read users from S3 via userStore
    const allUsers = await userStore.getAllUsers();
    
    // Transform and filter for Lab Engineers
    const labEngineers = allUsers
      .filter(user => user.role === 'Lab Engineer')
      .map(user => ({
        user_id: user.user_id || user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organisation_id: user.organisation_id,
        customer_id: user.customer_id,
        created_at: user.created_at ? new Date(user.created_at) : new Date()
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

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

// Create user (Admin only)
export const createUser = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // MIGRATED: Removed DB guard - now S3-only
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Only Admin can create users
    const authError = await checkRole(['Admin'])(event);
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

    // Parse and validate request body
    if (!event.body) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing request body',
        error: 'Request body is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const requestBody = parseBody(event);
    if (!requestBody) {
      return createResponse(400, { success: false, message: "Invalid JSON body" });
    }
    const validation = CreateUserSchema.safeParse(requestBody);
    
    if (!validation.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const userData = validation.data;

    // Register user using auth service (stores in S3)
    try {
      const authResult = await authService.register({
        email: userData.email,
        password: userData.password,
        name: userData.name,
        role: userData.role
      });

      // Clear cache to force reload on next request
      userStore.clearUsersCache();

      const response = createResponse(201, {
        success: true,
        message: 'User created successfully',
        data: {
          user_id: authResult.user.id,
          name: authResult.user.name,
          email: authResult.user.email,
          role: authResult.user.role,
          created_at: new Date().toISOString()
        }
      });

      logResponse(response, Date.now() - startTime);
      return response;
    } catch (error: any) {
      logger.warn('User creation failed', { email: userData.email, error: error.message });
      const statusCode = error.message.includes('already exists') ? 409 : 500;
      const response = createResponse(statusCode, {
        success: false,
        message: error.message || 'Failed to create user',
        error: error.message || 'User creation failed'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
  } catch (error) {
    logger.error('Error creating user:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create user'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

export const getUserById = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // MIGRATED: Removed DB guard - now S3-only
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

    // Read users from S3 via userStore
    const foundUser = await userStore.findUserById(userId);
    
    if (!foundUser) {
      const response = createResponse(404, {
        success: false,
        message: 'User not found',
        error: 'No user exists with the provided ID'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
    
    // Transform to match expected format
    const user: User = {
      user_id: foundUser.user_id || foundUser.id,
      name: foundUser.name,
      email: foundUser.email,
      role: foundUser.role,
      organisation_id: foundUser.organisation_id,
      customer_id: foundUser.customer_id,
      created_at: foundUser.created_at ? new Date(foundUser.created_at) : new Date()
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
