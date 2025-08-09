import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken, GeologicalLogSchema, validateInput } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { parse } from 'csv-parse/sync';
import { insertGeologicalLog } from '../models/geologicalLog';
import { getProjectById } from '../models/projects';
import { z } from 'zod';

// CSV Schema for borelog upload
const BorelogCSVSchema = z.object({
  project_name: z.string().min(1, 'Project name is required'),
  client_name: z.string().min(1, 'Client name is required'),
  design_consultant: z.string().min(1, 'Design consultant is required'),
  job_code: z.string().min(1, 'Job code is required'),
  project_location: z.string().min(1, 'Project location is required'),
  chainage_km: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "Chainage KM must be a valid number"
  }).optional(),
  area: z.string().min(1, 'Area is required'),
  borehole_location: z.string().min(1, 'Borehole location is required'),
  borehole_number: z.string().min(1, 'Borehole number is required'),
  msl: z.string().optional(),
  method_of_boring: z.string().min(1, 'Method of boring is required'),
  diameter_of_hole: z.string().refine(val => !isNaN(parseFloat(val)), {
    message: "Diameter of hole must be a valid number"
  }),
  commencement_date: z.string().min(1, 'Commencement date is required'),
  completion_date: z.string().min(1, 'Completion date is required'),
  standing_water_level: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "Standing water level must be a valid number"
  }).optional(),
  termination_depth: z.string().refine(val => !isNaN(parseFloat(val)), {
    message: "Termination depth must be a valid number"
  }),
  coordinate_lat: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "Coordinate latitude must be a valid number"
  }).optional(),
  coordinate_lng: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "Coordinate longitude must be a valid number"
  }).optional(),
  type_of_core_barrel: z.string().optional(),
  bearing_of_hole: z.string().optional(),
  collar_elevation: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "Collar elevation must be a valid number"
  }).optional(),
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

    // Ensure the project exists and capture its authoritative name
    const project = await getProjectById(projectId);
    if (!project) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid projectId: project not found',
        error: 'PROJECT_NOT_FOUND'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const targetProjectName = project.name;

    // Parse CSV data
    let parsedData;
    try {
      logger.info('Parsing CSV data...');
      parsedData = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      logger.info(`Parsed ${parsedData.length} rows from CSV`);
      logger.info('First row sample:', parsedData[0]);
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
        // Validate row data with CSV schema first
        const csvValidation = BorelogCSVSchema.safeParse(row);
        if (!csvValidation.success) {
          errors.push({
            row: rowNumber,
            errors: csvValidation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
          });
          continue;
        }

        const csvData = csvValidation.data;
        logger.info(`Processing validated data for row ${rowNumber}:`, { 
          borehole_number: csvData.borehole_number,
          project_name: csvData.project_name 
        });

        // Convert string values to appropriate types
        const borelogData = {
          // Override CSV project to the selected project to avoid mismatches
          project_name: targetProjectName,
          client_name: csvData.client_name,
          design_consultant: csvData.design_consultant,
          job_code: csvData.job_code,
          project_location: csvData.project_location,
          chainage_km: csvData.chainage_km ? parseFloat(csvData.chainage_km) : undefined,
          area: csvData.area,
          borehole_location: csvData.borehole_location,
          borehole_number: csvData.borehole_number,
          msl: csvData.msl,
          method_of_boring: csvData.method_of_boring,
          diameter_of_hole: parseFloat(csvData.diameter_of_hole),
          commencement_date: csvData.commencement_date,
          completion_date: csvData.completion_date,
          standing_water_level: csvData.standing_water_level ? parseFloat(csvData.standing_water_level) : undefined,
          termination_depth: parseFloat(csvData.termination_depth),
          coordinate: (csvData.coordinate_lat && csvData.coordinate_lng) ? {
            type: 'Point',
            coordinates: [parseFloat(csvData.coordinate_lng), parseFloat(csvData.coordinate_lat)]
          } : undefined,
          type_of_core_barrel: csvData.type_of_core_barrel,
          bearing_of_hole: csvData.bearing_of_hole,
          collar_elevation: csvData.collar_elevation ? parseFloat(csvData.collar_elevation) : undefined,
          // Store substructure_id for later assignment
          _substructure_id: csvData.substructure_id, // Temporary field for processing
          logged_by: csvData.logged_by,
          checked_by: csvData.checked_by,
          // Add missing optional fields with default values
          lithology: undefined,
          rock_methodology: undefined,
          structural_condition: undefined,
          weathering_classification: undefined,
          fracture_frequency_per_m: undefined,
          size_of_core_pieces_distribution: undefined,
          remarks: undefined,
          created_by_user_id: payload.userId
        };

        // Validate the borelog data with the proper schema
        logger.info(`Validating borelog data for row ${rowNumber}:`, borelogData);
        const validationResult = validateInput(borelogData, GeologicalLogSchema);
        if (!validationResult.success) {
          logger.error(`Validation failed for row ${rowNumber}:`, validationResult.error);
          errors.push({
            row: rowNumber,
            borehole_number: csvData.borehole_number,
            error: `Validation error: ${validationResult.error}`
          });
          continue;
        }
        logger.info(`Validation successful for row ${rowNumber}`);

        // Create the geological log
        logger.info(`Attempting to create borelog for row ${rowNumber}, borehole: ${csvData.borehole_number}`);
        logger.info('Validated data being sent to database:', JSON.stringify(validationResult.data, null, 2));
        const createdBorelog = await insertGeologicalLog(validationResult.data);
        logger.info(`Successfully created borelog with ID: ${createdBorelog.borelog_id}`, { createdBorelog });

        // If substructure_id is provided, assign it
        if (borelogData._substructure_id) {
          try {
            await query(
              'INSERT INTO borelog_substructure_mapping (borelog_id, substructure_id) VALUES ($1, $2)',
              [createdBorelog.borelog_id, borelogData._substructure_id]
            );
            logger.info(`Assigned substructure ${borelogData._substructure_id} to borelog ${createdBorelog.borelog_id}`);
          } catch (subError) {
            logger.warn(`Failed to assign substructure to borelog ${createdBorelog.borelog_id}:`, subError);
            errors.push({
              row: rowNumber,
              borehole_number: csvData.borehole_number,
              error: `Created borelog but failed to assign substructure: ${(subError as Error).message}`
            });
          }
        }
        
        results.push({
          row: rowNumber,
          borehole_number: csvData.borehole_number,
          borelog_id: createdBorelog.borelog_id,
          status: 'created',
          substructure_assigned: borelogData._substructure_id ? true : undefined
        });

      } catch (error) {
        logger.error(`Error processing row ${rowNumber}:`, error);
        errors.push({
          row: rowNumber,
          borehole_number: row.borehole_number || 'Unknown',
          error: error instanceof Error ? error.message : 'Failed to create borelog'
        });
      }
    }

    logger.info(`CSV upload summary: ${results.length} successful, ${errors.length} errors`);
    logger.info('Results:', results);
    logger.info('Errors:', errors);
    
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