import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserRole } from '../utils/validateInput';
import * as db from '../db';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { z } from 'zod';

import { getSecret } from '../utils/secrets';

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

export interface User {
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  organisation_id?: string;
  customer_id?: string;
  date_created: Date;
  created_at: Date;
}

// Generate JWT token
const generateToken = async (userId: string, email: string, role: UserRole): Promise<string> => {
  // In development, use a fixed secret
  const JWT_SECRET = process.env.NODE_ENV === 'production' 
    ? await getSecret('JWT_SECRET')
    : 'your-fixed-development-secret-key-make-it-long-and-secure-123';

  logger.info('Generating token:', { 
    userId, 
    email, 
    role,
    hasJwtSecret: !!JWT_SECRET,
    jwtSecretLength: JWT_SECRET?.length || 0,
    isDevelopment: process.env.NODE_ENV !== 'production'
  });

  const token = jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  logger.info('Token generated successfully:', { tokenLength: token.length });
  return token;
};

// Hash password
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
};

// Compare password
const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

// Login handler
export const login = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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
    
    // Find user in database
    const rows = await db.query<User & { password_hash: string }>(
      `SELECT user_id, name, email, role, organisation_id, customer_id, date_created, created_at, password_hash
       FROM users 
       WHERE email = $1`,
      [email]
    );
    
    if (rows.length === 0) {
      const response = createResponse(401, {
        success: false,
        message: 'Invalid credentials',
        error: 'Email or password is incorrect'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
    
    const user = rows[0];
    
    // Check if user has a password hash (for existing users without passwords)
    if (!user.password_hash) {
      const response = createResponse(401, {
        success: false,
        message: 'Account not properly configured',
        error: 'Please contact administrator to set up your account'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
    
    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    
    if (!isPasswordValid) {
      const response = createResponse(401, {
        success: false,
          message: 'Invalid credentials',
        error: 'Email or password is incorrect'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
    
    // Generate token
    const token = await generateToken(user.user_id, user.email, user.role);
    
    // Return user info and token (excluding password hash)
    const { password_hash: _, ...userWithoutPassword } = user;
    
    const response = createResponse(200, {
      success: true,
        message: 'Login successful',
        data: {
          token,
        user: {
          ...userWithoutPassword,
          date_created: new Date(user.date_created),
          created_at: new Date(user.created_at)
        }
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;
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
    
    // Check if user with this email already exists
    const existingUser = await db.query<User>(
      'SELECT user_id FROM users WHERE email = $1',
      [userData.email]
    );

    if (existingUser.length > 0) {
      const response = createResponse(409, {
        success: false,
        message: 'User with this email already exists',
        error: 'Email address is already in use'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
    
    // Hash password
    const hashedPassword = await hashPassword(userData.password);
    
    // Create new user
    const userId = require('uuid').v4();
    const rows = await db.query<User>(
      `INSERT INTO users (user_id, name, email, role, organisation_id, customer_id, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING user_id, name, email, role, organisation_id, customer_id, date_created, created_at`,
      [
        userId,
        userData.name,
        userData.email,
        userData.role,
        userData.organisation_id || null,
        userData.customer_id || null,
        hashedPassword
      ]
    );
    
    const newUser = rows[0];
    
    // Generate token
    const token = await generateToken(newUser.user_id, newUser.email, newUser.role);
    
    const response = createResponse(201, {
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: {
          ...newUser,
          date_created: new Date(newUser.date_created),
          created_at: new Date(newUser.created_at)
        }
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;
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
    // Extract authorization header
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    
    if (!authHeader) {
      const response = createResponse(401, {
        success: false,
          message: 'Unauthorized: No token provided',
        error: 'Authentication required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
    
    // Remove 'Bearer ' prefix if present
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    
    // Get JWT secret and verify token
    let decoded;
    try {
      // Use the same JWT secret as token generation
      const JWT_SECRET = process.env.NODE_ENV === 'production' 
        ? await getSecret('JWT_SECRET')
        : 'your-fixed-development-secret-key-make-it-long-and-secure-123';
      
      // Log token info (without exposing the actual token)
      logger.info('Token validation attempt:', { 
        tokenLength: token.length,
        hasJwtSecret: !!JWT_SECRET,
        jwtSecretLength: JWT_SECRET?.length || 0,
        isDevelopment: process.env.NODE_ENV !== 'production'
      });
      
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: UserRole };
      logger.info('Token decoded successfully:', { userId: decoded.userId, email: decoded.email, role: decoded.role });
    } catch (error) {
      logger.error('Token verification failed:', error);
      const response = createResponse(401, {
        success: false,
        message: 'Invalid or expired token',
        error: 'Authentication failed'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
    
    logger.info('Attempting to fetch user:', { userId: decoded.userId });

    // Find user in database
    const rows = await db.query<User>(
      `SELECT user_id, name, email, role, organisation_id, customer_id, date_created, created_at
       FROM users 
       WHERE user_id = $1`,
      [decoded.userId]
    );

    logger.info('User query result:', { rowCount: rows.length });
    
    if (rows.length === 0) {
      const response = createResponse(404, {
        success: false,
          message: 'User not found',
        error: 'User does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
    
    const user = rows[0];
    
    const response = createResponse(200, {
      success: true,
        message: 'User information retrieved successfully',
      data: {
        ...user,
        date_created: new Date(user.date_created),
        created_at: new Date(user.created_at)
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