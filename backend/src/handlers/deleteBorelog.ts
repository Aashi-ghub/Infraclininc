import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { checkRole, validateToken } from '../utils/validateInput';
import { validate as validateUUID } from 'uuid';
import * as db from '../db';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Admin and Project Manager can delete borelogs
    const authError = await checkRole(['Admin', 'Project Manager'])(event);
    if (authError !== null) {
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

    const borelogId = event.pathParameters?.borelog_id || event.pathParameters?.borelogId;
    if (!borelogId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing borelog_id parameter',
        error: 'borelog_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    if (!validateUUID(borelogId)) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid borelog_id format',
        error: 'borelog_id must be a valid UUID'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const pool = await db.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Ensure borelog exists and get project info for Project Manager validation
      const existsRes = await client.query(
        'SELECT borelog_id, project_id FROM boreloge WHERE borelog_id = $1', 
        [borelogId]
      );
      if (existsRes.rows.length === 0) {
        await client.query('ROLLBACK');
        const response = createResponse(404, {
          success: false,
          message: 'Borelog not found',
          error: `No borelog found with ID ${borelogId}`
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }

      const borelog = existsRes.rows[0];

      // For Project Managers, check if they have access to the project
      if (payload.role === 'Project Manager') {
        const projectAccessRes = await client.query(
          'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2 AND role = $3',
          [borelog.project_id, payload.userId, 'Project Manager']
        );
        
        if (projectAccessRes.rows.length === 0) {
          await client.query('ROLLBACK');
          const response = createResponse(403, {
            success: false,
            message: 'Access denied',
            error: 'You do not have permission to delete borelogs from this project'
          });
          logResponse(response, Date.now() - startTime);
          return response;
        }
      }

      // Delete child records first (defensive if FK constraints lack cascade)
      await client.query('DELETE FROM borelog_images WHERE borelog_id = $1', [borelogId]).catch(() => {});
      await client.query('DELETE FROM borelog_assignments WHERE borelog_id = $1', [borelogId]).catch(() => {});
      await client.query('DELETE FROM stratum_layers WHERE borelog_id = $1', [borelogId]).catch(() => {});
      await client.query('DELETE FROM borelog_details WHERE borelog_id = $1', [borelogId]).catch(() => {});
      
      // Delete borelog submissions related to this borelog
      await client.query(
        'DELETE FROM borelog_submissions WHERE borehole_id IN (SELECT borehole_id FROM borehole WHERE project_id = $1)',
        [borelog.project_id]
      ).catch(() => {});

      // Finally delete borelog
      await client.query('DELETE FROM boreloge WHERE borelog_id = $1', [borelogId]);

      await client.query('COMMIT');

      const response = createResponse(200, {
        success: true,
        message: 'Borelog deleted successfully'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Failed to delete borelog:', err);
      const response = createResponse(500, {
        success: false,
        message: 'Internal server error',
        error: 'Failed to delete borelog'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error in deleteBorelog handler:', error);
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to delete borelog'
    });
    logResponse(response, Date.now() - startTime);
    return response;
  }
};


