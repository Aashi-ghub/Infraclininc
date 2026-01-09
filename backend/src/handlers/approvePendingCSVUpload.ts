import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { z } from 'zod';
import * as db from '../db';
import { guardDbRoute } from '../db';
import { parseBody } from '../utils/parseBody';

// Schema for approving pending CSV uploads
const ApprovePendingCSVUploadSchema = z.object({
  action: z.enum(['approve', 'reject', 'return_for_revision']),
  comments: z.string().optional(),
  revision_notes: z.string().optional()
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('approvePendingCSVUpload');
  if (dbGuard) return dbGuard;

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Only Approval Engineer, Admin, or Project Manager can approve CSV uploads
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

    const requestBody = parseBody(event);
    if (!requestBody) {
      return createResponse(400, { success: false, message: "Invalid JSON body" });
    }
    const validatedData = ApprovePendingCSVUploadSchema.parse(requestBody);
    const { action, comments, revision_notes } = validatedData;

    // Get the pending CSV upload
    const pool = await db.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get the pending upload
      const uploadResult = await client.query(
        `SELECT * FROM pending_csv_uploads WHERE upload_id = $1 AND status = 'pending'`,
        [uploadId]
      );

      if (uploadResult.rows.length === 0) {
        await client.query('ROLLBACK');
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
            stratum_layers_created: createdBorelog.stratum_layers_created
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

  // Best-effort: populate additional header fields used by the edit form
  try {
    // Check if the columns exist before trying to update them
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'borelog_details' 
      AND column_name IN ('job_code', 'location', 'chainage_km')
    `);
    
    const existingColumns = columnCheck.rows.map(row => row.column_name);
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    if (existingColumns.includes('job_code')) {
      updateFields.push(`job_code = $${paramIndex++}`);
      updateValues.push(borelogHeaderData.job_code || null);
    }
    if (existingColumns.includes('location')) {
      updateFields.push(`location = $${paramIndex++}`);
      updateValues.push(borelogHeaderData.location || null);
    }
    if (existingColumns.includes('chainage_km')) {
      updateFields.push(`chainage_km = $${paramIndex++}`);
      updateValues.push(borelogHeaderData.chainage_km || null);
    }
    
    if (updateFields.length > 0) {
      updateValues.push(borelog_id);
      await client.query(
        `UPDATE borelog_details 
         SET ${updateFields.join(', ')}
         WHERE borelog_id = $${paramIndex} AND version_no = 1`,
        updateValues
      );
      logger.info(`Updated borelog_details with fields: ${updateFields.join(', ')}`);
    } else {
      logger.info('No additional fields to update in borelog_details');
    }
  } catch (e) {
    logger.warn('Error updating optional fields in borelog_details:', e);
  }

  // Create stratum records for each stratum row
  const stratumIds: string[] = [];
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
    const stratumLayerId = stratumResult.rows[0].id;
    stratumIds.push(stratumLayerId);

    // Prefer explicit samples array (multiple subdivision rows)
    if (Array.isArray(stratum.samples) && stratum.samples.length > 0) {
      for (let sampleIndex = 0; sampleIndex < stratum.samples.length; sampleIndex++) {
        const sample = stratum.samples[sampleIndex];

        // Determine depth mode/values
        let depthMode: 'single' | 'range' = 'single';
        let depthSingle: number | null = null;
        let depthFrom: number | null = null;
        let depthTo: number | null = null;
        let runLength: number | null = null;

        if (sample.sample_event_depth_m) {
          const d = parseFloat(sample.sample_event_depth_m);
          if (!isNaN(d)) depthSingle = d;
        } else if (stratum.stratum_depth_from && stratum.stratum_depth_to) {
          const df = parseFloat(stratum.stratum_depth_from);
          const dt = parseFloat(stratum.stratum_depth_to);
          if (!isNaN(df) && !isNaN(dt)) {
            depthMode = 'range';
            depthFrom = df;
            depthTo = dt;
            runLength = +(dt - df).toFixed(2);
          }
        }

        // Compute N-value if not provided
        let nValue: number | null = null;
        const b2s = sample.spt_blows_2 ? parseFloat(sample.spt_blows_2) : NaN;
        const b3s = sample.spt_blows_3 ? parseFloat(sample.spt_blows_3) : NaN;
        if (!isNaN(b2s) || !isNaN(b3s)) {
          nValue = (isNaN(b2s) ? 0 : b2s) + (isNaN(b3s) ? 0 : b3s);
        } else if (sample.n_value_is_2131 && !isNaN(parseFloat(sample.n_value_is_2131))) {
          nValue = parseFloat(sample.n_value_is_2131);
        }

        // Compute TCR/RQD if possible
        let tcrPercent: number | null = null;
        let rqdPercent: number | null = null;
        const totalCoreCmS = sample.total_core_length_cm ? parseFloat(sample.total_core_length_cm) : NaN;
        const rqdLenCmS = sample.rqd_length_cm ? parseFloat(sample.rqd_length_cm) : NaN;
        if (!isNaN(totalCoreCmS) && runLength && runLength > 0) {
          tcrPercent = +(((totalCoreCmS / 100) / runLength) * 100).toFixed(2);
        } else if (sample.tcr_percent && !isNaN(parseFloat(sample.tcr_percent))) {
          tcrPercent = parseFloat(sample.tcr_percent);
        }
        if (!isNaN(rqdLenCmS) && runLength && runLength > 0) {
          rqdPercent = +(((rqdLenCmS / 100) / runLength) * 100).toFixed(2);
        } else if (sample.rqd_percent && !isNaN(parseFloat(sample.rqd_percent))) {
          rqdPercent = parseFloat(sample.rqd_percent);
        }

        await client.query(
          `INSERT INTO stratum_sample_points (
            stratum_layer_id, sample_order, sample_type, depth_mode, depth_single_m,
            depth_from_m, depth_to_m, run_length_m,
            spt_15cm_1, spt_15cm_2, spt_15cm_3, n_value,
            total_core_length_cm, tcr_percent, rqd_length_cm, rqd_percent,
            created_by_user_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
          [
            stratumLayerId,
            sampleIndex + 1,
            sample.sample_event_type || null,
            depthMode,
            depthSingle,
            depthFrom,
            depthTo,
            runLength,
            sample.spt_blows_1 ? parseFloat(sample.spt_blows_1) : null,
            sample.spt_blows_2 ? parseFloat(sample.spt_blows_2) : null,
            sample.spt_blows_3 ? parseFloat(sample.spt_blows_3) : null,
            nValue,
            !isNaN(totalCoreCmS) ? totalCoreCmS : null,
            tcrPercent,
            !isNaN(rqdLenCmS) ? rqdLenCmS : null,
            rqdPercent,
            upload.uploaded_by
          ]
        );
      }
    } else if (
      stratum.sample_event_type ||
      stratum.sample_event_depth_m ||
      stratum.spt_blows_1 || stratum.spt_blows_2 || stratum.spt_blows_3 ||
      stratum.n_value_is_2131 ||
      stratum.total_core_length_cm || stratum.tcr_percent ||
      stratum.rqd_length_cm || stratum.rqd_percent
    ) {
      // Single-sample fallback using flat fields
      let depthMode: 'single' | 'range' = 'single';
      let depthSingle: number | null = null;
      let depthFrom: number | null = null;
      let depthTo: number | null = null;
      let runLength: number | null = null;

      if (stratum.sample_event_depth_m) {
        const d = parseFloat(stratum.sample_event_depth_m);
        if (!isNaN(d)) depthSingle = d;
      } else if (stratum.stratum_depth_from && stratum.stratum_depth_to) {
        const df = parseFloat(stratum.stratum_depth_from);
        const dt = parseFloat(stratum.stratum_depth_to);
        if (!isNaN(df) && !isNaN(dt)) {
          depthMode = 'range';
          depthFrom = df;
          depthTo = dt;
          runLength = +(dt - df).toFixed(2);
        }
      }

      let nValue: number | null = null;
      const b2 = stratum.spt_blows_2 ? parseFloat(stratum.spt_blows_2) : NaN;
      const b3 = stratum.spt_blows_3 ? parseFloat(stratum.spt_blows_3) : NaN;
      if (!isNaN(b2) || !isNaN(b3)) {
        nValue = (isNaN(b2) ? 0 : b2) + (isNaN(b3) ? 0 : b3);
      } else if (stratum.n_value_is_2131 && !isNaN(parseFloat(stratum.n_value_is_2131))) {
        nValue = parseFloat(stratum.n_value_is_2131);
      }

      let tcrPercent: number | null = null;
      let rqdPercent: number | null = null;
      const totalCoreCm = stratum.total_core_length_cm ? parseFloat(stratum.total_core_length_cm) : NaN;
      const rqdLenCm = stratum.rqd_length_cm ? parseFloat(stratum.rqd_length_cm) : NaN;
      if (!isNaN(totalCoreCm) && runLength && runLength > 0) {
        tcrPercent = +(((totalCoreCm / 100) / runLength) * 100).toFixed(2);
      } else if (stratum.tcr_percent && !isNaN(parseFloat(stratum.tcr_percent))) {
        tcrPercent = parseFloat(stratum.tcr_percent);
      }
      if (!isNaN(rqdLenCm) && runLength && runLength > 0) {
        rqdPercent = +(((rqdLenCm / 100) / runLength) * 100).toFixed(2);
      } else if (stratum.rqd_percent && !isNaN(parseFloat(stratum.rqd_percent))) {
        rqdPercent = parseFloat(stratum.rqd_percent);
      }

      await client.query(
        `INSERT INTO stratum_sample_points (
          stratum_layer_id, sample_order, sample_type, depth_mode, depth_single_m,
          depth_from_m, depth_to_m, run_length_m,
          spt_15cm_1, spt_15cm_2, spt_15cm_3, n_value,
          total_core_length_cm, tcr_percent, rqd_length_cm, rqd_percent,
          created_by_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          stratumLayerId,
          1,
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
          !isNaN(totalCoreCm) ? totalCoreCm : null,
          tcrPercent,
          !isNaN(rqdLenCm) ? rqdLenCm : null,
          rqdPercent,
          upload.uploaded_by
        ]
      );
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
    sample_points_created: stratumRowsData.filter(s => s.sample_event_type || s.spt_blows_1 || s.total_core_length_cm).length
  };
}
