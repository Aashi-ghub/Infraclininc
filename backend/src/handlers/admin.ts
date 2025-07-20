import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole } from '../utils/validateInput';
import { logger } from '../utils/logger';
import { query } from '../db';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Validation schemas
const UserCreateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  role: z.enum(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer']),
  organisation_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional()
});

const UserUpdateSchema = UserCreateSchema.partial();

// Admin Handlers
export const createUser = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authError = checkRole(['Admin'])(event);
    if (authError) return authError;

    const body = JSON.parse(event.body || '{}');
    const validationResult = UserCreateSchema.safeParse(body);

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

    const userData = validationResult.data;
    const userId = uuidv4();

    const result = await query(
      'INSERT INTO users (user_id, name, email, role, organisation_id, customer_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, userData.name, userData.email, userData.role, userData.organisation_id, userData.customer_id]
    );

    return {
      statusCode: 201,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'User created successfully',
        data: result[0],
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error creating user:', error);
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

export const updateUserRole = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authError = checkRole(['Admin'])(event);
    if (authError) return authError;

    const userId = event.pathParameters?.userId;
    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'User ID is required',
          status: 'error'
        })
      };
    }

    const body = JSON.parse(event.body || '{}');
    const validationResult = UserUpdateSchema.safeParse(body);

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

    const updateData = validationResult.data;
    const result = await query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *',
      [updateData.role, userId]
    );

    if (result.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'User not found',
          status: 'error'
        })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'User role updated successfully',
        data: result[0],
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error updating user role:', error);
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

export const listUsers = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authError = checkRole(['Admin'])(event);
    if (authError) return authError;

    const result = await query(
      'SELECT user_id, name, email, role, organisation_id, customer_id, created_at, updated_at FROM users ORDER BY created_at DESC',
      []
    );

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Users retrieved successfully',
        data: result,
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error listing users:', error);
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