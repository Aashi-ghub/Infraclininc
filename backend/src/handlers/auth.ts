import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UserRole } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { z } from 'zod';
import * as authService from '../auth/authService';

// Schema for login request
const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

// Schema for register request
const RegisterSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer'] as const),
  organisation_id: z.string().uuid('Invalid organisation ID').optional(),
  customer_id: z.string().uuid('Invalid customer ID').optional()
});

// User interface moved to authService module

// Auth functions are now in authService module

// Login handler
export const login = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // CRITICAL: Console log to ensure we see requests even if logger fails
  console.log('[AUTH HANDLER] Login handler called', {
    path: event.path,
    method: event.httpMethod,
    hasBody: !!event.body,
    headers: event.headers ? Object.keys(event.headers) : []
  });
  
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Parse request body
    if (!event.body) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing request body',
        error: 'Request body is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const requestBody = JSON.parse(event.body);
    const validation = LoginSchema.safeParse(requestBody);
    
    if (!validation.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const { email, password } = validation.data;
    
    logger.info('[AUTH] Login attempt', { email });
    
    // Login using auth service (TEMPORARY: uses JSON file, will migrate to Cognito)
    try {
      const authResult = await authService.login({ email, password });
      
      logger.info('[AUTH] Login successful', { 
        userId: authResult.user.id, 
        email: authResult.user.email, 
        role: authResult.user.role 
      });
      
      // Ensure response format matches frontend expectations exactly
      // Frontend expects: response.data.data = { token, user: { id, email, name, role } }
      const response = createResponse(200, {
        success: true,
        message: 'Login successful',
        data: {
          token: authResult.token,
          user: {
            id: authResult.user.id,
            email: authResult.user.email,
            name: authResult.user.name,
            role: authResult.user.role
          }
        }
      });

      logResponse(response, Date.now() - startTime);
      return response;
    } catch (error: any) {
      logger.warn('[AUTH] Login failed', { email, error: error.message });
      const response = createResponse(401, {
        success: false,
        message: error.message || 'Invalid credentials',
        error: 'Email or password is incorrect'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
  } catch (error) {
    logger.error('Login error:', error);
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to process login'
    });
    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Register handler (Admin only for now, can be made public later)
export const register = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Parse request body
    if (!event.body) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing request body',
        error: 'Request body is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const requestBody = JSON.parse(event.body);
    const validation = RegisterSchema.safeParse(requestBody);
    
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
    
    // Register using auth service (TEMPORARY: stores in JSON file, will migrate to Cognito)
    try {
      const authResult = await authService.register({
        email: userData.email,
        password: userData.password,
        name: userData.name,
        role: userData.role
      });
      
      const response = createResponse(201, {
        success: true,
        message: 'User registered successfully',
        data: {
          token: authResult.token,
          user: authResult.user
        }
      });

      logResponse(response, Date.now() - startTime);
      return response;
    } catch (error: any) {
      logger.warn('[AUTH] Registration failed', { email: userData.email, error: error.message });
      const statusCode = error.message.includes('already exists') ? 409 : 500;
      const response = createResponse(statusCode, {
        success: false,
        message: error.message || 'Failed to register user',
        error: error.message || 'Registration failed'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
  } catch (error) {
    logger.error('Register error:', error);
    const response = createResponse(500, {
      success: false,
        message: 'Internal server error',
      error: 'Failed to register user'
    });
    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Get current user info handler
export const me = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Extract authorization header (handle various formats for frontend compatibility)
    // Frontend sends: Authorization: Bearer <token>
    const authHeader = event.headers?.Authorization || 
                       event.headers?.authorization ||
                       event.headers?.['Authorization'] ||
                       event.headers?.['authorization'];
    
    if (!authHeader) {
      logger.warn('[AUTH] /auth/me called without Authorization header');
      const response = createResponse(401, {
        success: false,
        message: 'Unauthorized: No token provided',
        error: 'Authentication required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
    
    // Remove 'Bearer ' prefix if present (case-insensitive for compatibility)
    const token = authHeader.toLowerCase().startsWith('bearer ') 
      ? authHeader.slice(7).trim() 
      : authHeader.trim();
    
    logger.debug('[AUTH] Validating token for /auth/me');
    
    // Verify token using auth service
    const decoded = await authService.verifyToken(token);
    
    if (!decoded) {
      logger.warn('[AUTH] Token validation failed for /auth/me');
      const response = createResponse(401, {
        success: false,
        message: 'Invalid or expired token',
        error: 'Authentication failed'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
    
    // Get user from auth service (TEMPORARY: from JSON file, will migrate to Cognito)
    const user = authService.getUserById(decoded.userId);
    
    if (!user) {
      logger.warn('[AUTH] User not found', { userId: decoded.userId });
      const response = createResponse(404, {
        success: false,
        message: 'User not found',
        error: 'User does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
    
    logger.info('[AUTH] /auth/me successful', { userId: user.id, email: user.email, role: user.role });
    
    // Ensure response format matches frontend expectations exactly
    // Frontend expects: response.data.data = { id, email, name, role }
    const response = createResponse(200, {
      success: true,
      message: 'User information retrieved successfully',
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Get user info error:', error);
    const response = createResponse(500, {
      success: false,
        message: 'Internal server error',
      error: 'Failed to retrieve user information'
    });
    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 
