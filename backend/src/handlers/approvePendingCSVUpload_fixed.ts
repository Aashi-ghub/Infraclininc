import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import * as db from '../db';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  // Guard: Check if DB is enabled
  const dbGuard = db.guardDbRoute('approvePendingCSVUpload_fixed');
  if (dbGuard) return dbGuard;

  try {
    // Only Approval Engineer, Admin, or Project Manager can approve pending CSV uploads
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

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { action, comments, revision_notes } = body;

    if (!action || !['approve', 'reject', 'return_for_revision'].includes(action)) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid action. Must be approve, reject, or return_for_revision',
        error: 'Invalid action'
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
      await client.query('BEGIN');

      const uploadResult = await client.query(
        `SELECT * FROM pending_csv_uploads WHERE upload_id = $1 AND status = 'pending'`,
        [uploadId]
      );

      if (uploadResult.rows.length === 0) {
        const response = createResponse(404, {
          success: false,
          message: 'Pending CSV upload not found or already processed',
          error: 'Upload not found or status is not pending'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }

      const upload = uploadResult.rows[0];

      if (action === 'approve') {
        // Create the actual borelog from the pending data
        const createdBorelog = await createBorelogFromPendingUpload(client, upload);
        
        // Update the pending upload status
        await client.query(
          `UPDATE pending_csv_uploads 
           SET status = 'approved', approved_by = $1, approved_at = NOW(), 
               approval_comments = $2, processed_at = NOW(), created_borelog_id = $3
           WHERE upload_id = $4`,
          [payload.userId, comments || null, createdBorelog.borelog_id, uploadId]
        );

        await client.query('COMMIT');

        const response = createResponse(200, {
          success: true,
          message: 'CSV upload approved and borelog created successfully',
          data: {
            upload_id: uploadId,
            borelog_id: createdBorelog.borelog_id,
            status: 'approved',
            approved_by: payload.userId,
            stratum_layers_created: createdBorelog.stratum_layers_created,
            sample_points_created: createdBorelog.sample_points_created
          }
        });

        logResponse(response, Date.now() - startTime);
        return response;

      } else if (action === 'reject') {
        // Update the pending upload status to rejected
        await client.query(
          `UPDATE pending_csv_uploads 
           SET status = 'rejected', rejected_by = $1, rejected_at = NOW(), 
               rejection_reason = $2
           WHERE upload_id = $3`,
          [payload.userId, comments || 'Rejected by approver', uploadId]
        );

        await client.query('COMMIT');

        const response = createResponse(200, {
          success: true,
          message: 'CSV upload rejected successfully',
          data: {
            upload_id: uploadId,
            status: 'rejected',
            rejected_by: payload.userId,
            rejection_reason: comments || 'Rejected by approver'
          }
        });

        logResponse(response, Date.now() - startTime);
        return response;

      } else if (action === 'return_for_revision') {
        // Update the pending upload status to returned for revision
        await client.query(
          `UPDATE pending_csv_uploads 
           SET status = 'returned_for_revision', returned_by = $1, returned_at = NOW(), 
               revision_notes = $2
           WHERE upload_id = $3`,
          [payload.userId, revision_notes || 'Returned for revision', uploadId]
        );

        await client.query('COMMIT');

        const response = createResponse(200, {
          success: true,
          message: 'CSV upload returned for revision successfully',
          data: {
            upload_id: uploadId,
            status: 'returned_for_revision',
            returned_by: payload.userId,
            revision_notes: revision_notes || 'Returned for revision'
          }
        });

        logResponse(response, Date.now() - startTime);
        return response;
      }

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Error processing CSV upload approval:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to process CSV upload approval'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Helper function to create borelog from approved pending upload
async function createBorelogFromPendingUpload(client: any, upload: any) {
  const borelogHeaderData = upload.borelog_header_data;
  const stratumRowsData = upload.stratum_rows_data;

  // Create a borehole first if it doesn't exist
  let borehole_id: string;
  const existingBoreholeResult = await client.query(
    `SELECT borehole_id FROM borehole 
     WHERE project_id = $1 AND structure_id = $2 AND borehole_number = $3`,
    [upload.project_id, upload.structure_id, borelogHeaderData.borehole_no || borelogHeaderData.job_code]
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
        upload.project_id,
        upload.structure_id,
        borelogHeaderData.borehole_no || borelogHeaderData.job_code,
        borelogHeaderData.location || 'Location from CSV',
        upload.uploaded_by
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
    [upload.substructure_id, upload.project_id, 'Geotechnical', upload.uploaded_by]
  );

  const borelog_id = borelogResult.rows[0].borelog_id;

  // Create borelog details with header information
  await client.query(
    `INSERT INTO borelog_details (
      borelog_id, version_no, number, msl, boring_method, hole_diameter,
      commencement_date, completion_date, standing_water_level, termination_depth,
      permeability_test_count, spt_vs_test_count, undisturbed_sample_count,
      disturbed_sample_count, water_sample_count, remarks, created_by_user_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
    [
      borelog_id,
      1, // version_no
      borelogHeaderData.job_code, // Use job_code as the number
      borelogHeaderData.msl?.toString(),
      borelogHeaderData.method_of_boring,
      parseFloat(borelogHeaderData.diameter_of_hole),
      borelogHeaderData.commencement_date,
      borelogHeaderData.completion_date,
      borelogHeaderData.standing_water_level,
      borelogHeaderData.termination_depth,
      borelogHeaderData.permeability_tests_count?.toString(),
      `${borelogHeaderData.spt_tests_count || 0}&${borelogHeaderData.vs_tests_count || 0}`,
      borelogHeaderData.undisturbed_samples_count?.toString(),
      borelogHeaderData.disturbed_samples_count?.toString(),
      borelogHeaderData.water_samples_count?.toString(),
      borelogHeaderData.remarks,
      upload.uploaded_by
    ]
  );

  // Create stratum records for each stratum row
  const stratumIds: string[] = [];
  let samplePointsCreated = 0;

  for (let i = 0; i < stratumRowsData.length; i++) {
    const stratum = stratumRowsData[i];
    const stratumResult = await client.query(
      `INSERT INTO stratum_layers (
        id, borelog_id, version_no, layer_order, description, depth_from_m, depth_to_m, thickness_m,
        return_water_colour, water_loss, borehole_diameter, remarks, created_by_user_id
      ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        borelog_id,
        1, // version_no
        i + 1, // layer_order
        stratum.stratum_description,
        stratum.stratum_depth_from,
        stratum.stratum_depth_to,
        stratum.stratum_thickness_m,
        stratum.return_water_colour || null,
        stratum.water_loss || null,
        stratum.borehole_diameter || null,
        stratum.remarks || null,
        upload.uploaded_by
      ]
    );
    const stratumId = stratumResult.rows[0].id;
    stratumIds.push(stratumId);

    // Create sample points for this stratum if sample data exists
    if (stratum.sample_event_type || stratum.spt_blows_1 || stratum.total_core_length_cm) {
      logger.info(`Creating sample point for stratum ${i + 1} with sample data:`, {
        sample_type: stratum.sample_event_type,
        depth: stratum.sample_event_depth_m,
        spt_blows: [stratum.spt_blows_1, stratum.spt_blows_2, stratum.spt_blows_3]
      });

      // Determine depth mode and values
      let depthMode = 'single';
      let depthSingle = null;
      let depthFrom = null;
      let depthTo = null;
      let runLength = null;

      if (stratum.sample_event_depth_m) {
        depthSingle = parseFloat(stratum.sample_event_depth_m);
        depthMode = 'single';
      } else if (stratum.stratum_depth_from && stratum.stratum_depth_to) {
        depthFrom = parseFloat(stratum.stratum_depth_from);
        depthTo = parseFloat(stratum.stratum_depth_to);
        depthMode = 'range';
        runLength = depthTo - depthFrom;
      }

      // Calculate N-value from SPT blows
      let nValue = null;
      if (stratum.spt_blows_2 && stratum.spt_blows_3) {
        nValue = (parseFloat(stratum.spt_blows_2) || 0) + (parseFloat(stratum.spt_blows_3) || 0);
      } else if (stratum.n_value_is_2131) {
        nValue = parseFloat(stratum.n_value_is_2131);
      }

      // Calculate TCR and RQD percentages
      let tcrPercent = null;
      let rqdPercent = null;
      
      if (stratum.total_core_length_cm && runLength) {
        tcrPercent = (parseFloat(stratum.total_core_length_cm) / 100) / runLength * 100;
      } else if (stratum.tcr_percent) {
        tcrPercent = parseFloat(stratum.tcr_percent);
      }
      
      if (stratum.rqd_length_cm && runLength) {
        rqdPercent = (parseFloat(stratum.rqd_length_cm) / 100) / runLength * 100;
      } else if (stratum.rqd_percent) {
        rqdPercent = parseFloat(stratum.rqd_percent);
      }

      await client.query(
        `INSERT INTO stratum_sample_points (
          stratum_layer_id, sample_order, sample_type, depth_mode, depth_single_m,
          depth_from_m, depth_to_m, run_length_m, spt_15cm_1, spt_15cm_2, spt_15cm_3,
          n_value, total_core_length_cm, tcr_percent, rqd_length_cm, rqd_percent,
          created_by_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          stratumId,
          1, // sample_order (first sample for this stratum)
          stratum.sample_event_type || null,
          depthMode,
          depthSingle,
          depthFrom,
          depthTo,
          runLength,
          stratum.spt_blows_1 ? parseFloat(stratum.spt_blows_1) : null,
          stratum.spt_blows_2 ? parseFloat(stratum.spt_blows_2) : null,
          stratum.spt_blows_3 ? parseFloat(stratum.spt_blows_3) : null,
          nValue,
          stratum.total_core_length_cm ? parseFloat(stratum.total_core_length_cm) : null,
          tcrPercent,
          stratum.rqd_length_cm ? parseFloat(stratum.rqd_length_cm) : null,
          rqdPercent,
          upload.uploaded_by
        ]
      );
      
      samplePointsCreated++;
    }
  }

  // Create borelog submission record for version control
  await client.query(
    `INSERT INTO borelog_submissions (
      submission_id, project_id, structure_id, borehole_id, version_number, edited_by, form_data, status, created_by_user_id
    ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      upload.project_id,
      upload.structure_id,
      borehole_id,
      1,
      upload.uploaded_by,
      JSON.stringify({
        borelog_data: borelogHeaderData,
        stratum_data: stratumRowsData
      }),
      'approved',
      upload.uploaded_by
    ]
  );

  return {
    borelog_id,
    stratum_layers_created: stratumRowsData.length,
    sample_points_created: samplePointsCreated
  };
}


