import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import * as db from '../db';

// New CSV Schema for borelog upload (matching new borelog entry form)
const NewBorelogCSVSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  structure_id: z.string().uuid('Invalid structure ID'),
  substructure_id: z.string().uuid('Invalid substructure ID'),
  borehole_id: z.string().uuid('Invalid borehole ID'),
  job_code: z.string().min(1, 'Job code is required'),
  section_name: z.string().min(1, 'Section name is required'),
  coordinate_e: z.string().min(1, 'Easting coordinate is required'),
  coordinate_l: z.string().min(1, 'Northing coordinate is required'),
  location: z.string().min(1, 'Location is required'),
  method_of_boring: z.string().min(1, 'Method of boring is required'),
  diameter_of_hole: z.string().min(1, 'Diameter of hole is required'),
  commencement_date: z.string().min(1, 'Commencement date is required'),
  completion_date: z.string().min(1, 'Completion date is required'),
  borehole_number: z.string().optional(),
  chainage_km: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "Chainage KM must be a valid number"
  }).optional(),
  msl: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "MSL must be a valid number"
  }).optional(),
  standing_water_level: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "Standing water level must be a valid number"
  }).optional(),
  termination_depth: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "Termination depth must be a valid number"
  }).optional(),
  permeability_tests_count: z.string().refine(val => !val || !isNaN(parseInt(val)), {
    message: "Permeability tests count must be a valid number"
  }).optional(),
  spt_tests_count: z.string().refine(val => !val || !isNaN(parseInt(val)), {
    message: "SPT tests count must be a valid number"
  }).optional(),
  vs_tests_count: z.string().refine(val => !val || !isNaN(parseInt(val)), {
    message: "VS tests count must be a valid number"
  }).optional(),
  undisturbed_samples_count: z.string().refine(val => !val || !isNaN(parseInt(val)), {
    message: "Undisturbed samples count must be a valid number"
  }).optional(),
  disturbed_samples_count: z.string().refine(val => !val || !isNaN(parseInt(val)), {
    message: "Disturbed samples count must be a valid number"
  }).optional(),
  water_samples_count: z.string().refine(val => !val || !isNaN(parseInt(val)), {
    message: "Water samples count must be a valid number"
  }).optional(),
  version_number: z.string().refine(val => !val || !isNaN(parseInt(val)), {
    message: "Version number must be a valid number"
  }).optional(),
  status: z.string().optional(), // Accept any string, we'll map it later
  edited_by: z.string().uuid('Invalid edited_by user ID').optional(),
  editor_name: z.string().optional(),
});

// Helper function to map status values to valid enum values
function mapStatusValue(status: string | undefined): 'draft' | 'submitted' | 'approved' | 'rejected' {
  if (!status) return 'draft';
  
  const statusLower = status.toLowerCase();
  
  // Map common status values to valid enum values
  switch (statusLower) {
    case 'draft':
    case 'd':
      return 'draft';
    case 'submitted':
    case 'submit':
    case 's':
      return 'submitted';
    case 'approved':
    case 'approve':
    case 'a':
    case 'final':
    case 'f':
      return 'approved';
    case 'rejected':
    case 'reject':
    case 'r':
    case 'reviewed':
      return 'rejected';
    default:
      return 'draft'; // Default to draft for unknown values
  }
}

// Helper function to validate foreign key constraints
async function validateForeignKeys(borelogData: any) {
  const pool = await db.getPool();
  const client = await pool.connect();
  
  try {
    // Check if project exists
    const projectResult = await client.query(
      'SELECT project_id FROM projects WHERE project_id = $1',
      [borelogData.project_id]
    );
    if (projectResult.rows.length === 0) {
      throw new Error(`Project with ID ${borelogData.project_id} does not exist`);
    }

    // Check if structure exists
    const structureResult = await client.query(
      'SELECT structure_id FROM structure WHERE structure_id = $1',
      [borelogData.structure_id]
    );
    if (structureResult.rows.length === 0) {
      throw new Error(`Structure with ID ${borelogData.structure_id} does not exist`);
    }

    // Check if substructure exists
    const substructureResult = await client.query(
      'SELECT substructure_id FROM sub_structures WHERE substructure_id = $1',
      [borelogData.substructure_id]
    );
    if (substructureResult.rows.length === 0) {
      throw new Error(`Substructure with ID ${borelogData.substructure_id} does not exist`);
    }

    // Check if borehole exists
    const boreholeResult = await client.query(
      'SELECT borehole_id FROM borehole WHERE borehole_id = $1',
      [borelogData.borehole_id]
    );
    if (boreholeResult.rows.length === 0) {
      throw new Error(`Borehole with ID ${borelogData.borehole_id} does not exist`);
    }

  } finally {
    client.release();
  }
}

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
    const { csvData } = requestBody;

    if (!csvData) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing required fields',
        error: 'csvData is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Parse CSV data
    let parsedData;
    try {
      logger.info('Parsing CSV data...');
      logger.info('Raw CSV data (first 500 chars):', csvData.substring(0, 500));
      
      parsedData = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      
      logger.info(`Parsed ${parsedData.length} rows from CSV`);
      if (parsedData.length > 0) {
        logger.info('Available columns in first row:', Object.keys(parsedData[0]));
        logger.info('First row sample:', parsedData[0]);
      } else {
        logger.warn('No rows parsed from CSV');
      }
    } catch (error) {
      logger.error('CSV parsing error:', error);
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
        // Validate row data with new CSV schema
        const csvValidation = NewBorelogCSVSchema.safeParse(row);
        if (!csvValidation.success) {
          logger.error(`Validation failed for row ${rowNumber}:`, {
            availableColumns: Object.keys(row),
            expectedColumns: Object.keys(NewBorelogCSVSchema.shape),
            validationErrors: csvValidation.error.errors
          });
          
          errors.push({
            row: rowNumber,
            borehole_number: row.borehole_number || 'Unknown',
            errors: csvValidation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
            availableColumns: Object.keys(row)
          });
          continue;
        }

        const csvData = csvValidation.data;
        logger.info(`Processing validated data for row ${rowNumber}:`, { 
          borehole_number: csvData.borehole_number,
          project_id: csvData.project_id 
        });

        // Convert string values to appropriate types
        const borelogData = {
          project_id: csvData.project_id,
          structure_id: csvData.structure_id,
          substructure_id: csvData.substructure_id,
          borehole_id: csvData.borehole_id,
          job_code: csvData.job_code,
          section_name: csvData.section_name,
          coordinate_e: csvData.coordinate_e,
          coordinate_l: csvData.coordinate_l,
          location: csvData.location,
          method_of_boring: csvData.method_of_boring,
          diameter_of_hole: csvData.diameter_of_hole,
          commencement_date: csvData.commencement_date,
          completion_date: csvData.completion_date,
          borehole_number: csvData.borehole_number,
          chainage_km: csvData.chainage_km ? parseFloat(csvData.chainage_km) : null,
          msl: csvData.msl ? parseFloat(csvData.msl) : null,
          standing_water_level: csvData.standing_water_level ? parseFloat(csvData.standing_water_level) : null,
          termination_depth: csvData.termination_depth ? parseFloat(csvData.termination_depth) : null,
          permeability_tests_count: csvData.permeability_tests_count ? parseInt(csvData.permeability_tests_count) : 0,
          spt_tests_count: csvData.spt_tests_count ? parseInt(csvData.spt_tests_count) : 0,
          vs_tests_count: csvData.vs_tests_count ? parseInt(csvData.vs_tests_count) : 0,
          undisturbed_samples_count: csvData.undisturbed_samples_count ? parseInt(csvData.undisturbed_samples_count) : 0,
          disturbed_samples_count: csvData.disturbed_samples_count ? parseInt(csvData.disturbed_samples_count) : 0,
          water_samples_count: csvData.water_samples_count ? parseInt(csvData.water_samples_count) : 0,
          version_number: csvData.version_number ? parseInt(csvData.version_number) : 1,
          status: mapStatusValue(csvData.status), // Map status to valid enum
          edited_by: csvData.edited_by || payload.userId,
          editor_name: csvData.editor_name,
          created_by_user_id: payload.userId
        };

        // Validate foreign keys before attempting to create
        try {
          await validateForeignKeys(borelogData);
        } catch (fkError) {
          logger.error(`Foreign key validation failed for row ${rowNumber}:`, fkError);
          errors.push({
            row: rowNumber,
            borehole_number: csvData.borehole_number || 'Unknown',
            error: `Foreign key constraint violation: ${(fkError as Error).message}`
          });
          continue;
        }

        // Create the borelog using the new borelog creation API
        logger.info(`Attempting to create borelog for row ${rowNumber}, borehole: ${csvData.borehole_number}`);
        logger.info('Borelog data being sent to database:', JSON.stringify(borelogData, null, 2));
        
        // Call the createBorelog handler logic
        const createdBorelog = await createBorelogFromCSV(borelogData);
        logger.info(`Successfully created borelog with ID: ${createdBorelog.borelog_id}`, { createdBorelog });
        
        results.push({
          row: rowNumber,
          borehole_number: csvData.borehole_number || 'N/A',
          borelog_id: createdBorelog.borelog_id,
          status: 'created',
          mapped_status: mapStatusValue(csvData.status) // Include the mapped status for reference
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

// Helper function to create borelog from CSV data
async function createBorelogFromCSV(borelogData: any) {
  const pool = await db.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create the main borelog record
    const borelogResult = await client.query(
      `INSERT INTO boreloge (borelog_id, substructure_id, project_id, type, created_by_user_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       RETURNING borelog_id`,
      [borelogData.substructure_id, borelogData.project_id, 'Geotechnical', borelogData.created_by_user_id]
    );

    const borelog_id = borelogResult.rows[0].borelog_id;

    // Create borelog details
    const detailsResult = await client.query(
      `INSERT INTO borelog_details (
        borelog_id, version_no, number, msl, boring_method, hole_diameter,
        commencement_date, completion_date, standing_water_level, termination_depth,
        permeability_test_count, spt_vs_test_count, undisturbed_sample_count,
        disturbed_sample_count, water_sample_count, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING borelog_id`,
      [
        borelog_id,
        borelogData.version_number,
        borelogData.borehole_number || borelogData.job_code,
        borelogData.msl?.toString(),
        borelogData.method_of_boring,
        parseFloat(borelogData.diameter_of_hole),
        borelogData.commencement_date,
        borelogData.completion_date,
        borelogData.standing_water_level,
        borelogData.termination_depth,
        borelogData.permeability_tests_count?.toString(),
        `${borelogData.spt_tests_count}&${borelogData.vs_tests_count}`,
        borelogData.undisturbed_samples_count?.toString(),
        borelogData.disturbed_samples_count?.toString(),
        borelogData.water_samples_count?.toString(),
        borelogData.created_by_user_id
      ]
    );

    await client.query('COMMIT');

    return {
      borelog_id,
      version_no: borelogData.version_number,
      status: 'created'
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
} 