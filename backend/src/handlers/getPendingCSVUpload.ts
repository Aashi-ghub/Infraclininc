import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import * as db from '../db';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Only Approval Engineer, Admin, or Project Manager can view pending CSV uploads
    const authError = await checkRole(['Admin', 'Approval Engineer', 'Project Manager'])(event);
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

    const uploadId = event.pathParameters?.upload_id;
    if (!uploadId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing upload_id parameter',
        error: 'upload_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get the pending CSV upload
    const pool = await db.getPool();
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT 
          pcu.*,
          u.name as uploaded_by_name,
          u.email as uploaded_by_email,
          p.name as project_name,
          s.type as structure_type,
          ss.type as substructure_type,
          approver.name as approver_name,
          rejector.name as rejector_name,
          returner.name as returner_name
        FROM pending_csv_uploads pcu
        LEFT JOIN users u ON pcu.uploaded_by = u.user_id
        LEFT JOIN projects p ON pcu.project_id = p.project_id
        LEFT JOIN structure s ON pcu.structure_id = s.structure_id
        LEFT JOIN sub_structures ss ON pcu.substructure_id = ss.substructure_id
        LEFT JOIN users approver ON pcu.approved_by = approver.user_id
        LEFT JOIN users rejector ON pcu.rejected_by = rejector.user_id
        LEFT JOIN users returner ON pcu.returned_by = returner.user_id
        WHERE pcu.upload_id = $1`,
        [uploadId]
      );

      if (result.rows.length === 0) {
        const response = createResponse(404, {
          success: false,
          message: 'Pending CSV upload not found',
          error: 'Upload with the specified ID does not exist'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }

      const upload = result.rows[0];

      // Parse the CSV data
      let borelogHeaderData = {};
      let stratumRowsData = [];

      try {
        if (upload.borelog_header_data) {
          borelogHeaderData = upload.borelog_header_data;
        }
        if (upload.stratum_rows_data) {
          stratumRowsData = upload.stratum_rows_data;
        }
      } catch (error) {
        logger.warn('Failed to parse CSV data for upload:', upload.upload_id, error);
      }

      // Transform the data
      const transformedUpload = {
        upload_id: upload.upload_id,
        project_id: upload.project_id,
        structure_id: upload.structure_id,
        substructure_id: upload.substructure_id,
        uploaded_by: upload.uploaded_by,
        uploaded_by_name: upload.uploaded_by_name,
        uploaded_by_email: upload.uploaded_by_email,
        uploaded_at: upload.uploaded_at,
        file_name: upload.file_name,
        file_type: upload.file_type,
        total_records: upload.total_records,
        status: upload.status,
        submitted_for_approval_at: upload.submitted_for_approval_at,
        approved_by: upload.approved_by,
        approved_by_name: upload.approver_name,
        approved_at: upload.approved_at,
        rejected_by: upload.rejected_by,
        rejected_by_name: upload.rejector_name,
        rejected_at: upload.rejected_at,
        returned_by: upload.returned_by,
        returned_by_name: upload.returner_name,
        returned_at: upload.returned_at,
        approval_comments: upload.approval_comments,
        rejection_reason: upload.rejection_reason,
        revision_notes: upload.revision_notes,
        processed_at: upload.processed_at,
        created_borelog_id: upload.created_borelog_id,
        error_message: upload.error_message,
        project_name: upload.project_name,
        structure_type: upload.structure_type,
        substructure_type: upload.substructure_type,
        // Include full CSV data
        borelog_header: borelogHeaderData,
        stratum_rows: stratumRowsData,
        total_stratum_layers: stratumRowsData.length
      };

      const response = createResponse(200, {
        success: true,
        message: 'Pending CSV upload retrieved successfully',
        data: transformedUpload
      });

      logResponse(response, Date.now() - startTime);
      return response;

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Error getting pending CSV upload:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to get pending CSV upload'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};
