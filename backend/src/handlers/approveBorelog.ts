import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { getGeologicalLogById } from '../models/geologicalLog';
import { z } from 'zod';
import * as db from '../db';

const ApproveBorelogSchema = z.object({
  is_approved: z.boolean(),
  remarks: z.string().optional()
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Only Approval Engineer and Admin can approve borelogs
    const authError = checkRole(['Admin', 'Approval Engineer'])(event);
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

    const borelogId = event.pathParameters?.borelog_id;
    if (!borelogId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing borelog_id parameter',
        error: 'borelog_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Check if borelog exists
    const existingBorelog = await getGeologicalLogById(borelogId);
    if (!existingBorelog) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: 'Borelog with the specified ID does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Check if already approved
    if (existingBorelog.is_approved) {
      const response = createResponse(400, {
        success: false,
        message: 'Borelog already approved',
        error: 'Cannot modify approval status of already approved borelog'
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
    const validation = ApproveBorelogSchema.safeParse(requestBody);
    
    if (!validation.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const { is_approved, remarks } = validation.data;

    // If approving, publish the specified version from borelog_versions into borelog_details
    // Expect version_no in body when approving
    let updatedBorelog: any = null;
    if (is_approved) {
      const versionNoRaw = (requestBody as any).version_no;
      if (typeof versionNoRaw !== 'number') {
        const response = createResponse(400, {
          success: false,
          message: 'Missing version_no for approval',
          error: 'version_no must be provided when approving'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }

      // In a transaction: copy from borelog_versions -> borelog_details and mark version approved
      const publishResult = await db.transaction(async (client) => {
        // Get the version from staging
        const selectSql = `
          SELECT * FROM borelog_versions WHERE borelog_id = $1 AND version_no = $2
        `;
        const selectRes = await client.query(selectSql, [borelogId, versionNoRaw]);
        if (selectRes.rows.length === 0) {
          throw new Error('Requested version not found');
        }
        const v = selectRes.rows[0];

        // Insert into final table
        const insertSql = `
          INSERT INTO borelog_details (
            borelog_id, version_no, number, msl, boring_method, hole_diameter,
            commencement_date, completion_date, standing_water_level, termination_depth, coordinate,
            permeability_test_count, spt_vs_test_count, undisturbed_sample_count, disturbed_sample_count, water_sample_count,
            stratum_description, stratum_depth_from, stratum_depth_to, stratum_thickness_m,
            sample_event_type, sample_event_depth_m, run_length_m, spt_blows_per_15cm, n_value_is_2131,
            total_core_length_cm, tcr_percent, rqd_length_cm, rqd_percent, return_water_colour, water_loss,
            borehole_diameter, remarks, created_by_user_id
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
            $12,$13,$14,$15,$16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,
            $32,$33,$34
          ) ON CONFLICT (borelog_id, version_no) DO NOTHING RETURNING *;
        `;
        const insertRes = await client.query(insertSql, [
          v.borelog_id, v.version_no, v.number, v.msl, v.boring_method, v.hole_diameter,
          v.commencement_date, v.completion_date, v.standing_water_level, v.termination_depth, v.coordinate,
          v.permeability_test_count, v.spt_vs_test_count, v.undisturbed_sample_count, v.disturbed_sample_count, v.water_sample_count,
          v.stratum_description, v.stratum_depth_from, v.stratum_depth_to, v.stratum_thickness_m,
          v.sample_event_type, v.sample_event_depth_m, v.run_length_m, v.spt_blows_per_15cm, v.n_value_is_2131,
          v.total_core_length_cm, v.tcr_percent, v.rqd_length_cm, v.rqd_percent, v.return_water_colour, v.water_loss,
          v.borehole_diameter, v.remarks, v.created_by_user_id
        ]);

        // Mark version as approved
        const updateStageSql = `
          UPDATE borelog_versions SET status = 'approved', approved_by = $3, approved_at = NOW()
          WHERE borelog_id = $1 AND version_no = $2
        `;
        await client.query(updateStageSql, [v.borelog_id, v.version_no, payload.userId]);

        return insertRes.rows[0] || v;
      });

      updatedBorelog = publishResult;
    }

    // Log the approval action
    logger.info(`Borelog ${borelogId} ${is_approved ? 'approved' : 'rejected'} by user ${payload.userId}`, {
      borelogId,
      approvedBy: payload.userId,
      isApproved: is_approved,
      remarks
    });

    const response = createResponse(200, {
      success: true,
      message: `Borelog ${is_approved ? 'approved' : 'rejected'} successfully`,
      data: is_approved ? {
        borelog_id: borelogId,
        version_no: (requestBody as any).version_no,
        approved_by: payload.userId
      } : {
        borelog_id: borelogId,
        approved_by: payload.userId
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error approving borelog:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to approve borelog'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 