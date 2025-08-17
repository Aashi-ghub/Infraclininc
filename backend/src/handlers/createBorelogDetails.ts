import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import * as db from '../db';
import { z } from 'zod';

// Schema for borelog details creation
const CreateBorelogDetailsSchema = z.object({
  substructure_id: z.string().uuid('Invalid substructure_id'),
  project_id: z.string().uuid('Invalid project_id'),
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
    lat: z.number(),
    lng: z.number()
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
  remarks: z.string().optional(),
  images: z.string().optional()
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has Site Engineer role
    const authError = checkRole(['Site Engineer', 'Admin', 'Project Manager'])(event);
    if (authError) {
      return authError;
    }

    // Get user info from token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = validateToken(authHeader!);
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

    const requestBody = JSON.parse(event.body);
    const validation = CreateBorelogDetailsSchema.safeParse(requestBody);
    
    if (!validation.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const borelogData = validation.data;

    // Check if user has access to the project (for Site Engineers)
    if (payload.role === 'Site Engineer') {
      const projectAccessQuery = `
        SELECT 1 FROM user_project_assignments 
        WHERE project_id = $1 AND $2 = ANY(assignee)
      `;
      const projectAccess = await db.query(projectAccessQuery, [borelogData.project_id, payload.userId]);
      
      if (projectAccess.length === 0) {
        const response = createResponse(403, {
          success: false,
          message: 'Access denied: User not assigned to this project',
          error: 'Insufficient permissions'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
    }

    // Use transaction to ensure data consistency
    const result = await db.transaction(async (client) => {
      // Check if borelog exists for this substructure
      const existingBorelogQuery = `
        SELECT borelog_id FROM boreloge 
        WHERE substructure_id = $1 AND project_id = $2 AND type = $3
      `;
      const existingBorelog = await client.query(existingBorelogQuery, [
        borelogData.substructure_id, 
        borelogData.project_id, 
        borelogData.type
      ]);

      let borelogId: string;

      if (existingBorelog.rows.length === 0) {
        // Create new borelog
        const createBorelogQuery = `
          INSERT INTO boreloge (borelog_id, substructure_id, project_id, type, created_by_user_id)
          VALUES (gen_random_uuid(), $1, $2, $3, $4)
          RETURNING borelog_id
        `;
        const newBorelog = await client.query(createBorelogQuery, [
          borelogData.substructure_id,
          borelogData.project_id,
          borelogData.type,
          payload.userId
        ]);
        borelogId = newBorelog.rows[0].borelog_id;
      } else {
        borelogId = existingBorelog.rows[0].borelog_id;
      }

      // Get the next version number
      const versionQuery = `
        SELECT COALESCE(MAX(version_no), 0) + 1 as next_version
        FROM borelog_details 
        WHERE borelog_id = $1
      `;
      const versionResult = await client.query(versionQuery, [borelogId]);
      const versionNo = versionResult.rows[0].next_version;

      // Insert borelog details with version
      const insertDetailsQuery = `
        INSERT INTO borelog_details (
          borelog_id, version_no, number, msl, boring_method, hole_diameter,
          commencement_date, completion_date, standing_water_level, termination_depth,
          coordinate, permeability_test_count, spt_vs_test_count, undisturbed_sample_count,
          disturbed_sample_count, water_sample_count, stratum_description, stratum_depth_from,
          stratum_depth_to, stratum_thickness_m, sample_event_type, sample_event_depth_m,
          run_length_m, spt_blows_per_15cm, n_value_is_2131, total_core_length_cm,
          tcr_percent, rqd_length_cm, rqd_percent, return_water_colour, water_loss,
          borehole_diameter, remarks, images, created_by_user_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35
        ) RETURNING borelog_id, version_no
      `;

      const coordinateValue = borelogData.coordinate 
        ? `POINT(${borelogData.coordinate.lng} ${borelogData.coordinate.lat})`
        : null;

      const detailsResult = await client.query(insertDetailsQuery, [
        borelogId,
        versionNo,
        borelogData.number,
        borelogData.msl,
        borelogData.boring_method,
        borelogData.hole_diameter,
        borelogData.commencement_date,
        borelogData.completion_date,
        borelogData.standing_water_level,
        borelogData.termination_depth,
        coordinateValue,
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
        borelogData.images,
        payload.userId
      ]);

      return {
        borelog_id: borelogId,
        version_no: versionNo,
        details: detailsResult.rows[0]
      };
    });

    const response = createResponse(201, {
      success: true,
      message: 'Borelog details created successfully',
      data: result
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error creating borelog details:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create borelog details'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 