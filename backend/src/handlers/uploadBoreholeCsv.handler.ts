import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { parseBoreholeCsv } from '../utils/boreholeCsvParser';
import * as db from '../db';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  // Guard: Check if DB is enabled
  const dbGuard = db.guardDbRoute('uploadBoreholeCsv.handler');
  if (dbGuard) return dbGuard;

  try {
    // Only Project Manager and Admin can upload CSV
    const authError = await checkRole(['Admin', 'Project Manager'])(event);
    if (authError) {
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
    const { csvContent, projectId, structureId, substructureId } = requestBody;

    logger.info('Request body parsed:', {
      hasCsvContent: !!csvContent,
      csvContentLength: csvContent ? csvContent.length : 0,
      projectId,
      structureId,
      substructureId
    });

    if (!csvContent) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing required fields',
        error: 'csvContent is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Parse the CSV content using our borehole parser
    let parsedData;
    try {
      logger.info('Parsing borehole CSV content...');
      parsedData = await parseBoreholeCsv(csvContent);
      logger.info('CSV parsed successfully:', {
        projectName: parsedData.metadata.project_name,
        jobCode: parsedData.metadata.job_code,
        layersCount: parsedData.layers.length,
        remarksCount: parsedData.remarks.length
      });
    } catch (error) {
      logger.error('CSV parsing error:', error);
      const response = createResponse(400, {
        success: false,
        message: 'Invalid CSV format',
        error: `Failed to parse CSV data: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Validate required fields
    if (!parsedData.metadata.project_name || !parsedData.metadata.job_code) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing required metadata',
        error: 'Project name and job code are required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Create the borelog with parsed data
    try {
      logger.info('Creating borelog from parsed CSV data...');
      const createdBorelog = await createBorelogFromParsedData(
        parsedData, 
        projectId, 
        structureId, 
        substructureId, 
        (await payload).userId
      );

      const response = createResponse(201, {
        success: true,
        message: `Borelog created successfully with ${parsedData.layers.length} soil layers`,
        data: {
          borelog_id: createdBorelog.borelog_id,
          submission_id: createdBorelog.submission_id,
          job_code: parsedData.metadata.job_code,
          project_name: parsedData.metadata.project_name,
          soil_layers_created: parsedData.layers.length,
          sample_remarks: parsedData.remarks.length,
          core_quality: parsedData.core_quality,
          summary: {
            total_layers: parsedData.layers.length,
            total_samples: parsedData.remarks.length,
            termination_depth: parsedData.metadata.termination_depth,
            standing_water_level: parsedData.metadata.standing_water_level
          }
        }
      });

      logResponse(response, Date.now() - startTime);
      return response;

    } catch (error) {
      logger.error('Error creating borelog:', error);
      const response = createResponse(500, {
        success: false,
        message: 'Failed to create borelog',
        error: error instanceof Error ? error.message : 'Internal server error'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

  } catch (error) {
    logger.error('Error uploading borehole CSV:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to process borehole CSV upload'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Helper function to create borelog from parsed CSV data
async function createBorelogFromParsedData(
  parsedData: any, 
  projectId: string, 
  structureId: string, 
  substructureId: string, 
  userId: string
) {
  const pool = await db.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create a borehole first if it doesn't exist
    let borehole_id: string;
    const existingBoreholeResult = await client.query(
      `SELECT borehole_id FROM borehole 
       WHERE project_id = $1 AND structure_id = $2 AND borehole_number = $3`,
      [projectId, structureId, parsedData.metadata.borehole_no || parsedData.metadata.job_code]
    );

    if (existingBoreholeResult.rows.length > 0) {
      borehole_id = existingBoreholeResult.rows[0].borehole_id;
      logger.info('Using existing borehole:', borehole_id);
    } else {
      // Create new borehole
      const newBoreholeResult = await client.query(
        `INSERT INTO borehole (borehole_id, project_id, structure_id, borehole_number, location, created_by_user_id)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
         RETURNING borehole_id`,
        [
          projectId,
          structureId,
          parsedData.metadata.borehole_no || parsedData.metadata.job_code,
          parsedData.metadata.location || 'Location from CSV',
          userId
        ]
      );
      borehole_id = newBoreholeResult.rows[0].borehole_id;
      logger.info('Created new borehole:', borehole_id);
    }

    // Create the main borelog record
    const borelogResult = await client.query(
      `INSERT INTO boreloge (borelog_id, substructure_id, project_id, type, created_by_user_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       RETURNING borelog_id`,
      [substructureId, projectId, 'Geotechnical', userId]
    );

    const borelog_id = borelogResult.rows[0].borelog_id;

    // Create borelog details with metadata information
    const detailsResult = await client.query(
      `INSERT INTO borelog_details (
        borelog_id, version_no, number, msl, boring_method, hole_diameter,
        commencement_date, completion_date, standing_water_level, termination_depth,
        permeability_test_count, spt_vs_test_count, undisturbed_sample_count,
        disturbed_sample_count, water_sample_count, remarks, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING borelog_id`,
      [
        borelog_id,
        1, // version_no
        parsedData.metadata.job_code, // number
        parsedData.metadata.mean_sea_level?.toString(),
        parsedData.metadata.method_of_boring,
        parseFloat(parsedData.metadata.diameter_of_hole) || 0,
        parsedData.metadata.commencement_date,
        parsedData.metadata.completion_date,
        parsedData.metadata.standing_water_level,
        parsedData.metadata.termination_depth,
        parsedData.metadata.lab_tests.permeability_tests?.toString(),
        `${parsedData.metadata.lab_tests.sp_vs_tests}&0`, // SPT & VS tests
        parsedData.metadata.lab_tests.undisturbed_samples?.toString(),
        parsedData.metadata.lab_tests.disturbed_samples?.toString(),
        parsedData.metadata.lab_tests.water_samples?.toString(),
        `Project: ${parsedData.metadata.project_name}, Client: ${parsedData.metadata.client_address}`,
        userId
      ]
    );

    // Create stratum records for each soil layer
    const stratumIds: string[] = [];
    for (const layer of parsedData.layers) {
      const stratumResult = await client.query(
        `INSERT INTO stratum_layers (
          id, borelog_id, version_no, layer_order, description, depth_from_m, depth_to_m, thickness_m,
          return_water_colour, water_loss, borehole_diameter, remarks, created_by_user_id
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id`,
        [
          borelog_id,
          1, // version_no
          stratumIds.length + 1, // layer_order
          layer.description,
          layer.depth_from,
          layer.depth_to,
          layer.thickness,
          layer.colour_of_return_water || null,
          layer.water_loss || null,
          layer.diameter_of_borehole || null,
          layer.remarks || null,
          userId
        ]
      );
      stratumIds.push(stratumResult.rows[0].id);
    }

    // Create borelog submission record for version control
    const submissionResult = await client.query(
      `INSERT INTO borelog_submissions (
        project_id, structure_id, borehole_id, version_number, edited_by,
        form_data, status, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING submission_id`,
      [
        projectId,
        structureId,
        borehole_id,
        1, // version_number
        userId,
        JSON.stringify({
          rows: [
            {
              id: 'header',
              fields: [
                { id: 'project_name', name: 'Project Name', value: parsedData.metadata.project_name, fieldType: 'manual', isRequired: true },
                { id: 'job_code', name: 'Job Code', value: parsedData.metadata.job_code, fieldType: 'manual', isRequired: true },
                { id: 'client_address', name: 'Client Address', value: parsedData.metadata.client_address, fieldType: 'manual', isRequired: false },
                { id: 'location', name: 'Location', value: parsedData.metadata.location, fieldType: 'manual', isRequired: true },
                { id: 'method_of_boring', name: 'Method of Boring', value: parsedData.metadata.method_of_boring, fieldType: 'manual', isRequired: true },
                { id: 'diameter_of_hole', name: 'Diameter of Hole', value: parsedData.metadata.diameter_of_hole, fieldType: 'manual', isRequired: true },
                { id: 'commencement_date', name: 'Commencement Date', value: parsedData.metadata.commencement_date, fieldType: 'manual', isRequired: true },
                { id: 'completion_date', name: 'Completion Date', value: parsedData.metadata.completion_date, fieldType: 'manual', isRequired: true },
                { id: 'termination_depth', name: 'Termination Depth', value: parsedData.metadata.termination_depth, fieldType: 'manual', isRequired: true },
                { id: 'standing_water_level', name: 'Standing Water Level', value: parsedData.metadata.standing_water_level, fieldType: 'manual', isRequired: false }
              ],
              description: 'Borelog header information'
            },
            ...parsedData.layers.map((layer, index) => ({
              id: `stratum_${index}`,
              fields: [
                { id: 'description', name: 'Description', value: layer.description, fieldType: 'manual', isRequired: true },
                { id: 'depth_from', name: 'Depth From (m)', value: layer.depth_from, fieldType: 'manual', isRequired: true },
                { id: 'depth_to', name: 'Depth To (m)', value: layer.depth_to, fieldType: 'manual', isRequired: true },
                { id: 'thickness', name: 'Thickness (m)', value: layer.thickness, fieldType: 'calculated', isRequired: false },
                { id: 'sample_id', name: 'Sample ID', value: layer.sample_id, fieldType: 'manual', isRequired: false },
                { id: 'sample_depth', name: 'Sample Depth (m)', value: layer.sample_depth, fieldType: 'manual', isRequired: false },
                { id: 'n_value', name: 'N-Value', value: layer.n_value, fieldType: 'manual', isRequired: false },
                { id: 'tcr_percent', name: 'TCR (%)', value: layer.tcr_percent, fieldType: 'manual', isRequired: false },
                { id: 'rqd_percent', name: 'RQD (%)', value: layer.rqd_percent, fieldType: 'manual', isRequired: false },
                { id: 'return_water_colour', name: 'Colour of Return Water', value: layer.colour_of_return_water, fieldType: 'manual', isRequired: false },
                { id: 'water_loss', name: 'Water Loss', value: layer.water_loss, fieldType: 'manual', isRequired: false },
                { id: 'remarks', name: 'Remarks', value: layer.remarks, fieldType: 'manual', isRequired: false }
              ],
              description: `Soil layer ${index + 1}: ${layer.description.substring(0, 50)}...`
            }))
          ],
          metadata: {
            project_name: parsedData.metadata.project_name,
            job_code: parsedData.metadata.job_code,
            client_address: parsedData.metadata.client_address,
            location: parsedData.metadata.location,
            commencement_date: parsedData.metadata.commencement_date,
            completion_date: parsedData.metadata.completion_date,
            termination_depth: parsedData.metadata.termination_depth,
            standing_water_level: parsedData.metadata.standing_water_level,
            lab_tests: parsedData.metadata.lab_tests,
            core_quality: parsedData.core_quality,
            sample_remarks: parsedData.remarks
          }
        }),
        'draft', // status
        userId
      ]
    );

    await client.query('COMMIT');

    return {
      borelog_id,
      submission_id: submissionResult.rows[0].submission_id,
      version_no: 1,
      status: 'created',
      soil_layers_created: parsedData.layers.length
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
