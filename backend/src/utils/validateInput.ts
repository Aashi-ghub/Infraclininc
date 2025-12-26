import dotenv from 'dotenv';
dotenv.config();

console.log("[ENV CHECK]", {
  IS_OFFLINE: process.env.IS_OFFLINE,
  STORAGE_MODE: process.env.STORAGE_MODE,
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
  AWS_REGION: process.env.AWS_REGION,
});

// Force offline flag off when explicitly using S3 to avoid local fallback
if ((process.env.STORAGE_MODE || '').toLowerCase() === 's3') {
  process.env.IS_OFFLINE = 'false';
}

import { z } from 'zod';
import { logger } from './logger';
import { APIGatewayProxyResult } from 'aws-lambda';

// Define user roles
export type UserRole = 'Admin' | 'Project Manager' | 'Site Engineer' | 'Approval Engineer' | 'Lab Engineer' | 'Customer';

// JWT payload interface
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// Import auth service for token validation
import * as authService from '../auth/authService';

// Function to validate JWT token
export const validateToken = async (token: string): Promise<JwtPayload | null> => {
  try {
    // Handle various Authorization header formats for frontend compatibility
    // Supports: "Bearer <token>", "<token>", or just the token string
    let tokenString = token;
    
    if (typeof token === 'string') {
      // Remove 'Bearer ' prefix if present (case-insensitive)
      if (token.toLowerCase().startsWith('bearer ')) {
        tokenString = token.slice(7);
      } else {
        tokenString = token.trim();
      }
    }
    
    // Special handling for development mock token
    if (process.env.IS_OFFLINE && tokenString === 'mock-jwt-token-for-development') {
      logger.debug('[AUTH] Using development mock token');
      // Return a mock payload for development
      return {
        userId: 'u_admin',
        email: 'admin@backendbore.com',
        role: 'Admin'
      };
    }
    
    // Use auth service to verify token (TEMPORARY: uses JWT, will work with Cognito too)
    const payload = await authService.verifyToken(tokenString);
    
    if (payload) {
      logger.debug(`[AUTH] Token validated successfully for user ${payload.userId} (${payload.email})`);
    } else {
      logger.warn('[AUTH] Token validation failed - invalid or expired token');
    }
    
    return payload;
  } catch (error) {
    logger.error('[AUTH] Token validation error:', error);
    return null;
  }
};

// Function to check if user has required role
export const hasRole = (userRole: UserRole, requiredRoles: UserRole[]): boolean => {
  return requiredRoles.includes(userRole);
};

// RBAC middleware function
export const checkRole = (requiredRoles: UserRole[]) => {
  return async (event: any): Promise<APIGatewayProxyResult | null> => {
    // Extract authorization header (handle both capitalized and lowercase)
    // Frontend sends: Authorization: Bearer <token>
    const authHeader = event.headers?.Authorization || 
                       event.headers?.authorization ||
                       event.headers?.['Authorization'] ||
                       event.headers?.['authorization'];
    
    if (!authHeader) {
      logger.warn('[AUTH] No Authorization header provided in request');
      return {
        statusCode: 401,
        body: JSON.stringify({
          message: 'Unauthorized: No token provided',
          status: 'error'
        })
      };
    }
    
    logger.debug('[AUTH] Authorization header found, validating token');
    
    // Validate token
    const payload = await validateToken(authHeader);
    
    if (!payload) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          message: 'Unauthorized: Invalid token',
          status: 'error'
        })
      };
    }
    
    // Check role
    if (!hasRole(payload.role, requiredRoles)) {
      logger.warn(
        `[AUTH] Role rejection: User ${payload.userId} (${payload.email}) with role '${payload.role}' ` +
        `attempted to access endpoint requiring roles: ${requiredRoles.join(', ')}`
      );
      return {
        statusCode: 403,
        body: JSON.stringify({
          message: 'Forbidden: Insufficient permissions',
          status: 'error'
        })
      };
    }
    
    logger.debug(
      `[AUTH] Role check passed: User ${payload.userId} (${payload.email}) with role '${payload.role}' ` +
      `has access (required: ${requiredRoles.join(', ')})`
    );
    
    // Add user info to event for handlers to use
    event.user = payload;
    
    // Allow the request to proceed
    return null;
  };
};

export const GeologicalLogSchema = z.object({
  project_name: z.string(),
  client_name: z.string(),
  design_consultant: z.string(),
  job_code: z.string(),
  project_location: z.string(),
  chainage_km: z.number().optional(),
  area: z.string(),
  borehole_location: z.string(),
  borehole_number: z.string(),
  msl: z.string().optional(),
  method_of_boring: z.string(),
  diameter_of_hole: z.number(),
  commencement_date: z.string().transform((str) => new Date(str)),
  completion_date: z.string().transform((str) => new Date(str)),
  standing_water_level: z.number().optional(),
  termination_depth: z.number(),
  coordinate: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()]) // [longitude, latitude]
  }).optional().nullable(),
  type_of_core_barrel: z.string().optional(),
  bearing_of_hole: z.string().optional(),
  collar_elevation: z.number().optional(),
  logged_by: z.string(),
  checked_by: z.string(),
  lithology: z.string().optional(),
  rock_methodology: z.string().optional(),
  structural_condition: z.string().optional(),
  weathering_classification: z.string().optional(),
  fracture_frequency_per_m: z.number().optional(),
  size_of_core_pieces_distribution: z.record(z.string(), z.any()).optional(),
  remarks: z.string().optional(),
  created_by_user_id: z.string().uuid().nullable().optional()
});

export const BorelogDetailsSchema = z.object({
  borelog_id: z.string().uuid(),
  project_id: z.string().uuid().optional(), // Add optional project_id
  substructure_id: z.string().uuid().optional(), // Add optional substructure_id
  number: z.string(),
  msl: z.string().optional(),
  boring_method: z.string(),
  hole_diameter: z.number(),
  commencement_date: z.string().transform((str) => new Date(str)),
  completion_date: z.string().transform((str) => new Date(str)),
  standing_water_level: z.number().nullable().optional(),
  termination_depth: z.number().nullable().optional(),
  coordinate: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([
      z.number().min(-180).max(180), // longitude
      z.number().min(-90).max(90)    // latitude
    ])
  }).optional(),
  stratum_description: z.string().optional(),
  stratum_depth_from: z.number(),
  stratum_depth_to: z.number(),
  stratum_thickness_m: z.number(),
  remarks: z.string().optional(),
  created_by_user_id: z.string().uuid().optional() // Made optional
}).refine(
  (data) => data.stratum_depth_from < data.stratum_depth_to,
  {
    message: "stratum_depth_from must be less than stratum_depth_to",
    path: ["stratum_depth_from"]
  }
).refine(
  (data) => data.stratum_thickness_m === (data.stratum_depth_to - data.stratum_depth_from),
  {
    message: "stratum_thickness_m must equal the difference between stratum_depth_to and stratum_depth_from",
    path: ["stratum_thickness_m"]
  }
).refine(
  (data) => new Date(data.commencement_date) <= new Date(data.completion_date),
  {
    message: "completion_date must be on or after commencement_date",
    path: ["completion_date"]
  });

export type GeologicalLogInput = z.infer<typeof GeologicalLogSchema>;
export type BorelogDetailsInput = z.infer<typeof BorelogDetailsSchema>;

export function validateInput(data: unknown, schema: z.ZodSchema<any>): { success: boolean; data?: any; error?: string } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      logger.warn('Validation error', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
    logger.error('Unexpected validation error', { error });
    return { success: false, error: 'Internal validation error' };
  }
} 