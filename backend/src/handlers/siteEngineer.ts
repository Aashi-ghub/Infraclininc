import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole } from '../utils/validateInput';
import { logger } from '../utils/logger';
import { query } from '../db';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Validation schemas
const GeologicalLogCreateSchema = z.object({
  project_name: z.string(),
  client_name: z.string(),
  design_consultant: z.string().optional(),
  job_code: z.string().optional(),
  project_location: z.string(),
  chainage_km: z.number(),
  area: z.string(),
  borehole_location: z.string(),
  borehole_number: z.string(),
  msl: z.string(),
  method_of_boring: z.string(),
  diameter_of_hole: z.number(),
  commencement_date: z.string(),
  completion_date: z.string().optional(),
  standing_water_level: z.number().optional(),
  termination_depth: z.number(),
  coordinate: z.any(), // Will be converted to GEOGRAPHY type
  type_of_core_barrel: z.string().optional(),
  bearing_of_hole: z.string().optional(),
  collar_elevation: z.number().optional(),
  logged_by: z.string(),
  checked_by: z.string().optional(),
  lithology: z.string().optional(),
  rock_methodology: z.string().optional(),
  structural_condition: z.string().optional(),
  weathering_classification: z.string().optional(),
  fracture_frequency_per_m: z.number().optional(),
  remarks: z.string().optional()
});

// Site Engineer Handlers
export const createGeologicalLog = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authError = checkRole(['Site Engineer'])(event);
    if (authError) return authError;

    const body = JSON.parse(event.body || '{}');
    const validationResult = GeologicalLogCreateSchema.safeParse(body);

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

    const logData = validationResult.data;
    const borelogId = uuidv4();
    const userId = event.user?.userId;

    // Create geological log
    const result = await query(
      `INSERT INTO geological_log (
        borelog_id, project_name, client_name, design_consultant, job_code,
        project_location, chainage_km, area, borehole_location, borehole_number,
        msl, method_of_boring, diameter_of_hole, commencement_date, completion_date,
        standing_water_level, termination_depth, coordinate, type_of_core_barrel,
        bearing_of_hole, collar_elevation, logged_by, checked_by, lithology,
        rock_methodology, structural_condition, weathering_classification,
        fracture_frequency_per_m, remarks, created_by_user_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, ST_SetSRID(ST_MakePoint($18, $19), 4326), $20, $21, $22, $23, $24,
        $25, $26, $27, $28, $29, $30, $31
      ) RETURNING *`,
      [
        borelogId, logData.project_name, logData.client_name, logData.design_consultant,
        logData.job_code, logData.project_location, logData.chainage_km, logData.area,
        logData.borehole_location, logData.borehole_number, logData.msl,
        logData.method_of_boring, logData.diameter_of_hole, logData.commencement_date,
        logData.completion_date, logData.standing_water_level, logData.termination_depth,
        logData.coordinate.longitude, logData.coordinate.latitude, logData.type_of_core_barrel,
        logData.bearing_of_hole, logData.collar_elevation, logData.logged_by,
        logData.checked_by, logData.lithology, logData.rock_methodology,
        logData.structural_condition, logData.weathering_classification,
        logData.fracture_frequency_per_m, logData.remarks, userId
      ]
    );

    return {
      statusCode: 201,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Geological log created successfully',
        data: result[0],
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error creating geological log:', error);
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

export const getEngineerLogs = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authError = checkRole(['Site Engineer'])(event);
    if (authError) return authError;

    const userId = event.user?.userId;

    // Get all logs created by the engineer
    const logs = await query(
      `SELECT * FROM geological_log 
       WHERE created_by_user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Geological logs retrieved successfully',
        data: logs,
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error getting engineer logs:', error);
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

export const updateGeologicalLog = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authError = checkRole(['Site Engineer'])(event);
    if (authError) return authError;

    const borelogId = event.pathParameters?.borelog_id;
    if (!borelogId) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'Borelog ID is required',
          status: 'error'
        })
      };
    }

    const body = JSON.parse(event.body || '{}');
    const validationResult = GeologicalLogCreateSchema.partial().safeParse(body);

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
    const userId = event.user?.userId;

    // Verify engineer owns the log
    const ownership = await query(
      'SELECT created_by_user_id FROM geological_log WHERE borelog_id = $1',
      [borelogId]
    );

    if (ownership.length === 0 || ownership[0].created_by_user_id !== userId) {
      return {
        statusCode: 403,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'You do not have permission to update this log',
          status: 'error'
        })
      };
    }

    // Update the log
    const result = await query(
      `UPDATE geological_log 
       SET 
         project_name = COALESCE($1, project_name),
         client_name = COALESCE($2, client_name),
         design_consultant = COALESCE($3, design_consultant),
         job_code = COALESCE($4, job_code),
         project_location = COALESCE($5, project_location),
         updated_at = NOW()
       WHERE borelog_id = $6
       RETURNING *`,
      [
        updateData.project_name,
        updateData.client_name,
        updateData.design_consultant,
        updateData.job_code,
        updateData.project_location,
        borelogId
      ]
    );

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Geological log updated successfully',
        data: result[0],
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error updating geological log:', error);
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