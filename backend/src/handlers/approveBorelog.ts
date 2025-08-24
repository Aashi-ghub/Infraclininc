import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { z } from 'zod';
import * as db from '../db';

// Support both legacy and V2 payloads
// Legacy: { is_approved: boolean; remarks?: string; version_no?: number }
// V2 (frontend): { version_no: number; approved_by?: string; approval_comments?: string }
const ApproveBorelogSchemaV1 = z.object({
  is_approved: z.boolean(),
  remarks: z.string().optional(),
  version_no: z.number().optional()
});

const ApproveBorelogSchemaV2 = z.object({
  version_no: z.number(),
  approved_by: z.string().optional(),
  approval_comments: z.string().optional()
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Only Approval Engineer and Admin can approve borelogs
    const authError = await checkRole(['Admin', 'Approval Engineer'])(event);
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

    // Check if borelog exists in the new boreloge table (source of truth for versions)
    const existsSql = `SELECT 1 FROM boreloge WHERE borelog_id = $1`;
    const existsRes = await db.query(existsSql, [borelogId]);
    if (existsRes.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: 'Borelog with the specified ID does not exist in boreloge'
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
    const parsedV1 = ApproveBorelogSchemaV1.safeParse(requestBody);
    const parsedV2 = ApproveBorelogSchemaV2.safeParse(requestBody);

    if (!parsedV1.success && !parsedV2.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: [
          ...parsedV1.success ? [] : parsedV1.error.errors.map(err => `v1:${err.path.join('.')}: ${err.message}`),
          ...parsedV2.success ? [] : parsedV2.error.errors.map(err => `v2:${err.path.join('.')}: ${err.message}`)
        ].join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const is_approved = parsedV2.success ? true : parsedV1.data.is_approved;
    const remarks = parsedV2.success ? parsedV2.data.approval_comments : parsedV1.data.remarks;
    const versionNoRaw = parsedV2.success 
      ? parsedV2.data.version_no 
      : (typeof parsedV1.data.version_no === 'number' ? parsedV1.data.version_no : (requestBody as any).version_no);

    // If approving, publish the specified version from borelog_versions into borelog_details
    // Expect version_no in body when approving
    let updatedBorelog: any = null;
    if (is_approved) {
      if (typeof versionNoRaw !== 'number') {
        const response = createResponse(400, {
          success: false,
          message: 'Missing version_no for approval',
          error: 'version_no must be provided when approving'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }

      // Prevent duplicate approvals
      const alreadyApproved = await db.query(
        `SELECT 1 FROM borelog_details WHERE borelog_id = $1 AND version_no = $2`,
        [borelogId, versionNoRaw]
      );
      if (alreadyApproved.length > 0) {
        const response = createResponse(400, {
          success: false,
          message: 'Version already approved',
          error: `Borelog ${borelogId} version ${versionNoRaw} is already approved`
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }

      // Compatibility check: if schema has legacy PK (borelog_id only), block multiple approvals gracefully
      const pkCols = await db.query(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         WHERE tc.table_name = 'borelog_details' AND tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
         ORDER BY kcu.ordinal_position`
      );
      const pkColumnNames = pkCols.map((r: any) => r.column_name);
      const isLegacyPk = pkColumnNames.length === 1 && pkColumnNames[0] === 'borelog_id';
      if (isLegacyPk) {
        const anyFinal = await db.query(
          `SELECT 1 FROM borelog_details WHERE borelog_id = $1 LIMIT 1`,
          [borelogId]
        );
        if (anyFinal.length > 0) {
          // If a different version already exists in final and DB has legacy PK, inserting any new version will violate PK
          const response = createResponse(409, {
            success: false,
            message: 'A final version already exists for this borelog',
            error: 'To allow multiple approved versions, run migration change_borelog_details_pk_to_composite.sql'
          });
          logResponse(response, Date.now() - startTime);
          return response;
        }
      }

      // In a transaction: copy from borelog_versions -> borelog_details and mark version approved
      const publishResult = await db.transaction(async (client) => {
        // Get the version from staging
        const selectSql = `
          SELECT * FROM borelog_versions WHERE borelog_id = $1 AND version_no = $2
        `;
        const selectRes = await client.query(selectSql, [borelogId, versionNoRaw]);
        if (selectRes.rows.length === 0) {
          const err = new Error('Requested version not found');
          (err as any).statusCode = 404;
          throw err;
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
          ) ON CONFLICT ON CONSTRAINT borelog_details_pkey DO NOTHING RETURNING *;
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
        version_no: versionNoRaw,
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

    const status = (error as any).statusCode || 500;
    const message = status === 404 ? 'Version not found for this borelog' : 'Internal server error';
    const errDetail = (error as Error).message || 'Failed to approve borelog';

    const response = createResponse(status, {
      success: false,
      message,
      error: errDetail
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 
