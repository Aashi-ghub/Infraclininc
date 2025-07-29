import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { parse } from 'csv-parse/sync';
import { createGeologicalLog } from '../models/geologicalLog';
import { z } from 'zod';

// CSV Schema for borelog upload
const BorelogCSVSchema = z.object({
  project_name: z.string().min(1, 'Project name is required'),
  client_name: z.string().min(1, 'Client name is required'),
  design_consultant: z.string().min(1, 'Design consultant is required'),
  job_code: z.string().min(1, 'Job code is required'),
  project_location: z.string().min(1, 'Project location is required'),
  chainage_km: z.string().optional(),
  area: z.string().min(1, 'Area is required'),
  borehole_location: z.string().min(1, 'Borehole location is required'),
  borehole_number: z.string().min(1, 'Borehole number is required'),
  msl: z.string().optional(),
  method_of_boring: z.string().min(1, 'Method of boring is required'),
  diameter_of_hole: z.string().min(1, 'Diameter of hole is required'),
  commencement_date: z.string().min(1, 'Commencement date is required'),
  completion_date: z.string().min(1, 'Completion date is required'),
  standing_water_level: z.string().optional(),
  termination_depth: z.string().min(1, 'Termination depth is required'),
  coordinate_lat: z.string().optional(),
  coordinate_lng: z.string().optional(),
  type_of_core_barrel: z.string().optional(),
  bearing_of_hole: z.string().optional(),
  collar_elevation: z.string().optional(),
  logged_by: z.string().min(1, 'Logged by is required'),
  checked_by: z.string().min(1, 'Checked by is required'),
  substructure_id: z.string().optional(), // Link to substructure
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Only Project Manager and Admin can upload CSV
    const authError = checkRole(['Admin', 'Project Manager'])(event);
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
    const { csvData, projectId } = requestBody;

    if (!csvData || !projectId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing required fields',
        error: 'csvData and projectId are required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Parse CSV data
    let parsedData;
    try {
      parsedData = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
    } catch (error) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid CSV format',
        error: 'Failed to parse CSV data'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Validate and process each row
    const results = [];
    const errors = [];

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i];
      const rowNumber = i + 2; // +2 because CSV has header and arrays are 0-indexed

      try {
        // Validate row data
        const validation = BorelogCSVSchema.safeParse(row);
        if (!validation.success) {
          errors.push({
            row: rowNumber,
            errors: validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
          });
          continue;
        }

        const validatedData = validation.data;

        // Convert string values to appropriate types
        const borelogData = {
          project_name: validatedData.project_name,
          client_name: validatedData.client_name,
          design_consultant: validatedData.design_consultant,
          job_code: validatedData.job_code,
          project_location: validatedData.project_location,
          chainage_km: validatedData.chainage_km ? parseFloat(validatedData.chainage_km) : undefined,
          area: validatedData.area,
          borehole_location: validatedData.borehole_location,
          borehole_number: validatedData.borehole_number,
          msl: validatedData.msl,
          method_of_boring: validatedData.method_of_boring,
          diameter_of_hole: parseFloat(validatedData.diameter_of_hole),
          commencement_date: validatedData.commencement_date,
          completion_date: validatedData.completion_date,
          standing_water_level: validatedData.standing_water_level ? parseFloat(validatedData.standing_water_level) : undefined,
          termination_depth: parseFloat(validatedData.termination_depth),
          coordinate: (validatedData.coordinate_lat && validatedData.coordinate_lng) ? {
            type: 'Point',
            coordinates: [parseFloat(validatedData.coordinate_lng), parseFloat(validatedData.coordinate_lat)]
          } : undefined,
          type_of_core_barrel: validatedData.type_of_core_barrel,
          bearing_of_hole: validatedData.bearing_of_hole,
          collar_elevation: validatedData.collar_elevation ? parseFloat(validatedData.collar_elevation) : undefined,
          logged_by: validatedData.logged_by,
          checked_by: validatedData.checked_by,
          created_by_user_id: payload.userId,
          is_approved: false // Default to unapproved
        };

        // Create the geological log
        const createdBorelog = await createGeologicalLog(borelogData);
        
        results.push({
          row: rowNumber,
          borehole_number: validatedData.borehole_number,
          borelog_id: createdBorelog.borelog_id,
          status: 'created'
        });

      } catch (error) {
        logger.error(`Error processing row ${rowNumber}:`, error);
        errors.push({
          row: rowNumber,
          borehole_number: row.borehole_number || 'Unknown',
          error: 'Failed to create borelog'
        });
      }
    }

    const response = createResponse(201, {
      success: true,
      message: `CSV upload completed. ${results.length} borelogs created, ${errors.length} errors.`,
      data: {
        created: results,
        errors: errors,
        summary: {
          total_rows: parsedData.length,
          successful: results.length,
          failed: errors.length
        }
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error uploading CSV:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to process CSV upload'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 