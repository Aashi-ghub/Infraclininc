import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { parseBoreholeCsv } from '../utils/boreholeCsvParser';
import * as db from '../db';
import { guardDbRoute } from '../db';
import { getStorageService, validateFile, generateS3Key } from '../services/storageService';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('uploadBoreholeCsv');
  if (dbGuard) return dbGuard;

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
    const { csvContent, projectId, structureId, substructureId, fileName } = requestBody;

    logger.info('Request body parsed:', {
      hasCsvContent: !!csvContent,
      csvContentLength: csvContent ? csvContent.length : 0,
      projectId,
      structureId,
      substructureId,
      fileName
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

    if (!projectId || !structureId || !substructureId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing required fields',
        error: 'projectId, structureId, and substructureId are required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Convert CSV content to buffer and upload to S3
    let fileUrl: string | null = null;
    let csvBuffer: Buffer;
    let csvContentForParsing: string;

    try {
      // Check if csvContent is base64 encoded
      const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(csvContent.trim());
      
      if (isBase64 && csvContent.length > 100) {
        // Likely base64 encoded file
        csvBuffer = Buffer.from(csvContent, 'base64');
        csvContentForParsing = csvBuffer.toString('utf-8');
      } else {
        // Raw CSV text
        csvBuffer = Buffer.from(csvContent, 'utf-8');
        csvContentForParsing = csvContent;
      }

      // Validate file size and MIME type
      const mimeType = 'text/csv';
      const validation = validateFile(csvBuffer, mimeType, 'CSV');
      
      if (!validation.valid) {
        const response = createResponse(400, {
          success: false,
          message: 'File validation failed',
          error: validation.error
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }

      // Generate S3 key (we need a borelog_id, but we don't have one yet)
      // Use a temporary ID or project-based path
      const tempBorelogId = 'pending'; // Will be updated when borelog is created
      const s3Key = generateS3Key(
        projectId,
        tempBorelogId,
        'csv',
        fileName || `borehole_${Date.now()}.csv`
      );

      // Upload to S3
      const storageService = getStorageService();
      fileUrl = await storageService.uploadFile(
        csvBuffer,
        s3Key,
        mimeType,
        {
          project_id: projectId,
          structure_id: structureId,
          substructure_id: substructureId,
        }
      );

      logger.info('File uploaded to S3', { fileUrl, s3Key });
    } catch (error) {
      logger.error('Error uploading file to S3:', error);
      const response = createResponse(500, {
        success: false,
        message: 'Failed to upload file to S3',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    let parsedData;
    try {
      logger.info('Parsing borehole CSV content...');
      parsedData = await parseBoreholeCsv(csvContentForParsing);
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
        (await payload).userId,
        fileUrl,
        fileName || `borehole_${Date.now()}.csv`
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
  userId: string,
  fileUrl: string | null,
  fileName: string
) {
  const pool = await db.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Store the upload in pending_csv_uploads table
    // Note: file_url column must exist (added via migration)
    const uploadResult = await client.query(
      `INSERT INTO pending_csv_uploads (
        project_id, structure_id, substructure_id, uploaded_by, file_type, total_records,
        borelog_header_data, stratum_rows_data, status, file_name, file_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        'pending',
        fileName,
        fileUrl
      ]
    );

    await client.query('COMMIT');

    return {
      upload_id: uploadResult.rows[0].upload_id
    };

  } catch (error) {
    await client.query('ROLLBACK');
    // If file_url column doesn't exist, log warning but don't fail
    if (error instanceof Error && error.message.includes('column "file_url"')) {
      logger.warn('file_url column does not exist yet. Run migration: add_file_url_to_pending_csv_uploads.sql');
      // Retry without file_url
      try {
        await client.query('BEGIN');
        const uploadResult = await client.query(
          `INSERT INTO pending_csv_uploads (
            project_id, structure_id, substructure_id, uploaded_by, file_type, total_records,
            borelog_header_data, stratum_rows_data, status, file_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
            'pending',
            fileName
          ]
        );
        await client.query('COMMIT');
        logger.warn('Uploaded without file_url. File stored in S3 but URL not saved to DB.');
        return { upload_id: uploadResult.rows[0].upload_id };
      } catch (retryError) {
        await client.query('ROLLBACK');
        throw retryError;
      }
    }
    throw error;
  } finally {
    client.release();
  }
}
