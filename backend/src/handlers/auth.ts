import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import jwt from 'jsonwebtoken';
import { UserRole } from '../utils/validateInput';

// JWT secret key from environment variables or use a default for development
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';

// Mock users for development/testing
const mockUsers = {
  'admin@example.com': {
    id: 'user-admin',
    email: 'admin@example.com',
    password: 'password123',
    name: 'Admin User',
    role: 'Admin' as UserRole
  },
  'engineer@example.com': {
    id: 'user-engineer',
    email: 'engineer@example.com',
    password: 'password123',
    name: 'Engineer User',
    role: 'Engineer' as UserRole
  },
  'logger@example.com': {
    id: 'user-logger',
    email: 'logger@example.com',
    password: 'password123',
    name: 'Logger User',
    role: 'Logger' as UserRole
  },
  'viewer@example.com': {
    id: 'user-viewer',
    email: 'viewer@example.com',
    password: 'password123',
    name: 'Viewer User',
    role: 'Viewer' as UserRole
  }
};

// Generate JWT token
const generateToken = (userId: string, email: string, role: UserRole): string => {
  return jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Login handler
export const login = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Parse request body
    const requestBody = JSON.parse(event.body || '{}');
    const { email, password } = requestBody;
    
    // Validate input
    if (!email || !password) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Email and password are required',
          status: 'error'
        })
      };
    }
    
    // Find user (in a real app, this would query a database)
    const user = mockUsers[email];
    
    // Check if user exists and password matches
    if (!user || user.password !== password) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Invalid credentials',
          status: 'error'
        })
      };
    }
    
    // Generate token
    const token = generateToken(user.id, user.email, user.role);
    
    // Return user info and token (excluding password)
    const { password: _, ...userWithoutPassword } = user;
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Login successful',
        status: 'success',
        data: {
          token,
          user: userWithoutPassword
        }
      })
    };
  } catch (error) {
    console.error('Login error:', error);
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

// Get current user info handler
export const me = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Extract authorization header
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Unauthorized: No token provided',
          status: 'error'
        })
      };
    }
    
    // Remove 'Bearer ' prefix if present
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    
    // Verify and decode the token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: UserRole };
    
    // Find user (in a real app, this would query a database)
    const user = mockUsers[decoded.email];
    
    if (!user) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'User not found',
          status: 'error'
        })
      };
    }
    
    // Return user info (excluding password)
    const { password: _, ...userWithoutPassword } = user;
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'User information retrieved successfully',
        status: 'success',
        data: userWithoutPassword
      })
    };
  } catch (error) {
    console.error('Get user info error:', error);
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