import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { parseBoreholeCsv } from '../utils/boreholeCsvParser';
import * as db from '../db';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    const authError = await checkRole(['Admin', 'Project Manager'])(event);
    if (authError) {
      return authError;
    }

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

    if (!parsedData.metadata.project_name || !parsedData.metadata.job_code) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing required metadata',
        error: 'Project name and job code are required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    try {
      logger.info('Storing CSV upload in pending status...');
      const pendingUpload = await storePendingBoreholeCSVUpload(
        parsedData, 
        projectId, 
        structureId, 
        substructureId, 
        (await payload).userId
      );

      const response = createResponse(201, {
        success: true,
        message: `CSV upload stored successfully and pending approval. ${parsedData.layers.length} soil layers validated.`,
        data: {
          upload_id: pendingUpload.upload_id,
          status: 'pending',
          job_code: parsedData.metadata.job_code,
          project_name: parsedData.metadata.project_name,
          soil_layers_validated: parsedData.layers.length,
          sample_remarks: parsedData.remarks.length,
          core_quality: parsedData.core_quality,
          summary: {
            total_layers: parsedData.layers.length,
            total_samples: parsedData.remarks.length,
            termination_depth: parsedData.metadata.termination_depth,
            standing_water_level: parsedData.metadata.standing_water_level
          },
          next_steps: 'Upload is pending approval by an Approval Engineer, Admin, or Project Manager'
        }
      });

      logResponse(response, Date.now() - startTime);
      return response;

    } catch (error) {
      logger.error('Error storing pending CSV upload:', error);
      const response = createResponse(500, {
        success: false,
        message: 'Failed to store CSV upload',
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

// Helper function to store CSV upload in pending status for approval
async function storePendingBoreholeCSVUpload(
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

    // Store the upload in pending_csv_uploads table
    const uploadResult = await client.query(
      `INSERT INTO pending_csv_uploads (
        project_id, structure_id, substructure_id, uploaded_by, file_type, total_records,
        borelog_header_data, stratum_rows_data, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING upload_id`,
      [
        projectId,
        structureId,
        substructureId,
        userId,
        'csv',
        parsedData.layers.length,
        JSON.stringify({
          metadata: parsedData.metadata,
          core_quality: parsedData.core_quality,
          sample_remarks: parsedData.remarks
        }),
        JSON.stringify(parsedData.layers),
        'pending'
      ]
    );

    await client.query('COMMIT');

    return {
      upload_id: uploadResult.rows[0].upload_id
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
