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

    // Get query parameters
    const projectId = event.queryStringParameters?.project_id;
    const status = event.queryStringParameters?.status || 'pending';
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const offset = parseInt(event.queryStringParameters?.offset || '0');

    // Build the query
    let query = `
      SELECT 
        pcu.upload_id,
        pcu.project_id,
        pcu.structure_id,
        pcu.substructure_id,
        pcu.uploaded_by,
        pcu.uploaded_at,
        pcu.file_name,
        pcu.file_type,
        pcu.total_records,
        pcu.status,
        pcu.submitted_for_approval_at,
        pcu.approved_by,
        pcu.approved_at,
        pcu.rejected_by,
        pcu.rejected_at,
        pcu.returned_by,
        pcu.returned_at,
        pcu.approval_comments,
        pcu.rejection_reason,
        pcu.revision_notes,
        pcu.processed_at,
        pcu.created_borelog_id,
        pcu.error_message,
        u.name as uploaded_by_name,
        p.name as project_name,
        s.type as structure_type,
        ss.type as substructure_type
      FROM pending_csv_uploads pcu
      LEFT JOIN users u ON pcu.uploaded_by = u.user_id
      LEFT JOIN projects p ON pcu.project_id = p.project_id
      LEFT JOIN structure s ON pcu.structure_id = s.structure_id
      LEFT JOIN sub_structures ss ON pcu.substructure_id = ss.substructure_id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramCount = 0;

    if (projectId) {
      paramCount++;
      query += ` AND pcu.project_id = $${paramCount}`;
      queryParams.push(projectId);
    }

    if (status && status !== 'all') {
      paramCount++;
      query += ` AND pcu.status = $${paramCount}`;
      queryParams.push(status);
    }

    // Add ordering and pagination
    query += ` ORDER BY pcu.uploaded_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(limit, offset);

    // Get the pending uploads
    const pool = await db.getPool();
    const client = await pool.connect();

    try {
      const result = await client.query(query, queryParams);

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total
        FROM pending_csv_uploads pcu
        WHERE 1=1
      `;
      const countParams: any[] = [];
      let countParamCount = 0;

      if (projectId) {
        countParamCount++;
        countQuery += ` AND pcu.project_id = $${countParamCount}`;
        countParams.push(projectId);
      }

      if (status && status !== 'all') {
        countParamCount++;
        countQuery += ` AND pcu.status = $${countParamCount}`;
        countParams.push(status);
      }

      const countResult = await client.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

      // Transform the data to include parsed CSV information
      const transformedUploads = result.rows.map(upload => {
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

        return {
          upload_id: upload.upload_id,
          project_id: upload.project_id,
          structure_id: upload.structure_id,
          substructure_id: upload.substructure_id,
          uploaded_by: upload.uploaded_by,
          uploaded_by_name: upload.uploaded_by_name,
          uploaded_at: upload.uploaded_at,
          file_name: upload.file_name,
          file_type: upload.file_type,
          total_records: upload.total_records,
          status: upload.status,
          submitted_for_approval_at: upload.submitted_for_approval_at,
          approved_by: upload.approved_by,
          approved_at: upload.approved_at,
          rejected_by: upload.rejected_by,
          rejected_at: upload.rejected_at,
          returned_by: upload.returned_by,
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
          // Include parsed CSV data for preview
          borelog_header: borelogHeaderData,
          stratum_preview: stratumRowsData.slice(0, 3), // Show first 3 stratum rows as preview
          total_stratum_layers: stratumRowsData.length
        };
      });

      const response = createResponse(200, {
        success: true,
        message: `Retrieved ${transformedUploads.length} CSV uploads`,
        data: {
          uploads: transformedUploads,
          pagination: {
            total,
            limit,
            offset,
            has_more: offset + limit < total
          }
        }
      });

      logResponse(response, Date.now() - startTime);
      return response;

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Error listing pending CSV uploads:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to list pending CSV uploads'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};
