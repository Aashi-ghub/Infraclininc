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

    // Update the borelog approval status
    const updateQuery = `
      UPDATE geological_log 
      SET 
        is_approved = $1,
        approved_by = $2,
        approved_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END,
        updated_at = NOW()
      WHERE borelog_id = $3
      RETURNING *
    `;

    const updatedRows = await db.query(updateQuery, [
      is_approved,
      payload.userId,
      borelogId
    ]);

    if (updatedRows.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: 'Failed to update borelog'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const updatedBorelog = updatedRows[0];

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
      data: {
        borelog_id: updatedBorelog.borelog_id,
        is_approved: updatedBorelog.is_approved,
        approved_by: updatedBorelog.approved_by,
        approved_at: updatedBorelog.approved_at,
        updated_at: updatedBorelog.updated_at
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