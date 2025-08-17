import { APIGatewayProxyEvent } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { createResponse } from '../types/common';
import { logger, logRequest, logResponse } from '../utils/logger';
import { z } from 'zod';
import * as db from '../db';

// Borelog Creation Schema
const CreateBorelogSchema = z.object({
  substructure_id: z.string().uuid('Invalid substructure ID'),
  project_id: z.string().uuid('Invalid project ID'),
  type: z.enum(['Geotechnical', 'Geological']),
  // Borelog details fields
  number: z.string().optional(),
  msl: z.string().optional(),
  boring_method: z.string().optional(),
  hole_diameter: z.number().optional(),
  commencement_date: z.string().optional(),
  completion_date: z.string().optional(),
  standing_water_level: z.number().optional(),
  termination_depth: z.number().optional(),
  coordinate: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()])
  }).optional(),
  permeability_test_count: z.string().optional(),
  spt_vs_test_count: z.string().optional(),
  undisturbed_sample_count: z.string().optional(),
  disturbed_sample_count: z.string().optional(),
  water_sample_count: z.string().optional(),
  stratum_description: z.string().optional(),
  stratum_depth_from: z.number().optional(),
  stratum_depth_to: z.number().optional(),
  stratum_thickness_m: z.number().optional(),
  sample_event_type: z.string().optional(),
  sample_event_depth_m: z.number().optional(),
  run_length_m: z.number().optional(),
  spt_blows_per_15cm: z.number().optional(),
  n_value_is_2131: z.string().optional(),
  total_core_length_cm: z.number().optional(),
  tcr_percent: z.number().optional(),
  rqd_length_cm: z.number().optional(),
  rqd_percent: z.number().optional(),
  return_water_colour: z.string().optional(),
  water_loss: z.string().optional(),
  borehole_diameter: z.number().optional(),
  remarks: z.string().optional()
});

export const handler = async (event: APIGatewayProxyEvent) => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Site Engineer', 'Admin', 'Project Manager'])(event);
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

    if (!event.body) {
      const response = createResponse(400, {
        success: false,
        message: 'Request body is missing',
        error: 'Missing request body'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const data = JSON.parse(event.body);
    const validationResult = CreateBorelogSchema.safeParse(data);

    if (!validationResult.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation failed',
        error: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const borelogData = validationResult.data;

    // Check if user has access to the project
    const projectAccessQuery = `
      SELECT 1 FROM user_project_assignments 
      WHERE $1 = ANY(assignee) AND project_id = $2
    `;
    const projectAccess = await db.query(projectAccessQuery, [payload.userId, borelogData.project_id]);
    
    if (projectAccess.length === 0 && payload.role !== 'Admin') {
      const response = createResponse(403, {
        success: false,
        message: 'Access denied: User not assigned to this project',
        error: 'Insufficient permissions'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Check if substructure exists and belongs to the project
    const substructureQuery = `
      SELECT 1 FROM sub_structures 
      WHERE substructure_id = $1 AND project_id = $2
    `;
    const substructureCheck = await db.query(substructureQuery, [borelogData.substructure_id, borelogData.project_id]);
    
    if (substructureCheck.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Substructure not found or does not belong to the specified project',
        error: 'Invalid substructure_id or project_id'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Use transaction to create both boreloge and borelog_details
    const result = await db.transaction(async (client) => {
      // 1. Create boreloge record
      const borelogeInsertQuery = `
        INSERT INTO boreloge (
          borelog_id,
          substructure_id,
          project_id,
          type,
          created_by_user_id
        ) VALUES (
          gen_random_uuid(),
          $1, $2, $3, $4
        ) RETURNING borelog_id;
      `;

      const borelogeResult = await client.query(borelogeInsertQuery, [
        borelogData.substructure_id,
        borelogData.project_id,
        borelogData.type,
        payload.userId
      ]);

      const borelogId = borelogeResult.rows[0].borelog_id;

      // 2. Create borelog_details record
      const borelogDetailsInsertQuery = `
        INSERT INTO borelog_details (
          borelog_id,
          version_no,
          number,
          msl,
          boring_method,
          hole_diameter,
          commencement_date,
          completion_date,
          standing_water_level,
          termination_depth,
          coordinate,
          permeability_test_count,
          spt_vs_test_count,
          undisturbed_sample_count,
          disturbed_sample_count,
          water_sample_count,
          stratum_description,
          stratum_depth_from,
          stratum_depth_to,
          stratum_thickness_m,
          sample_event_type,
          sample_event_depth_m,
          run_length_m,
          spt_blows_per_15cm,
          n_value_is_2131,
          total_core_length_cm,
          tcr_percent,
          rqd_length_cm,
          rqd_percent,
          return_water_colour,
          water_loss,
          borehole_diameter,
          remarks,
          created_by_user_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
          $22, $23, $24, $25, $26, $27, $28, $29, $30, $31,
          $32, $33, $34
        ) RETURNING *;
      `;

      const borelogDetailsValues = [
        borelogId,
        1, // version_no - start with version 1
        borelogData.number,
        borelogData.msl,
        borelogData.boring_method,
        borelogData.hole_diameter,
        borelogData.commencement_date,
        borelogData.completion_date,
        borelogData.standing_water_level,
        borelogData.termination_depth,
        borelogData.coordinate ? `POINT(${borelogData.coordinate.coordinates[0]} ${borelogData.coordinate.coordinates[1]})` : null,
        borelogData.permeability_test_count,
        borelogData.spt_vs_test_count,
        borelogData.undisturbed_sample_count,
        borelogData.disturbed_sample_count,
        borelogData.water_sample_count,
        borelogData.stratum_description,
        borelogData.stratum_depth_from,
        borelogData.stratum_depth_to,
        borelogData.stratum_thickness_m,
        borelogData.sample_event_type,
        borelogData.sample_event_depth_m,
        borelogData.run_length_m,
        borelogData.spt_blows_per_15cm,
        borelogData.n_value_is_2131,
        borelogData.total_core_length_cm,
        borelogData.tcr_percent,
        borelogData.rqd_length_cm,
        borelogData.rqd_percent,
        borelogData.return_water_colour,
        borelogData.water_loss,
        borelogData.borehole_diameter,
        borelogData.remarks,
        payload.userId
      ];

      const borelogDetailsResult = await client.query(borelogDetailsInsertQuery, borelogDetailsValues);

      return {
        borelogId,
        borelogDetails: borelogDetailsResult.rows[0]
      };
    });

    // Transform the result to handle coordinate conversion
    const dbResult = result.borelogDetails as any;
    const borelogDetails = {
      ...dbResult,
      coordinate: dbResult.coordinate ? {
        type: 'Point' as const,
        coordinates: dbResult.coordinate.replace('POINT(', '').replace(')', '').split(' ').map(Number) as [number, number]
      } : undefined
    };

    const response = createResponse(201, {
      success: true,
      message: 'Borelog created successfully',
      data: {
        borelog_id: result.borelogId,
        version_no: result.borelogDetails.version_no,
        borelog_details: borelogDetails
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error creating borelog', { error });
    
    // Check for database constraint errors
    const pgError = error as any;
    if (pgError.code === '23503') {
      const response = createResponse(400, {
        success: false,
        message: 'Foreign key constraint violation',
        error: pgError.detail || 'A referenced record does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create borelog'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};
