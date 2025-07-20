import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole } from '../utils/validateInput';
import { logger } from '../utils/logger';
import { query } from '../db';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Validation schemas
const ReviewSchema = z.object({
  borelog_id: z.string().uuid(),
  status: z.enum(['Approved', 'Rejected', 'Needs Review']),
  comments: z.string().optional(),
  anomalies: z.array(z.object({
    type: z.string(),
    description: z.string(),
    severity: z.enum(['Low', 'Medium', 'High'])
  })).optional()
});

// Approval Engineer Handlers
export const reviewGeologicalLog = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authError = checkRole(['Approval Engineer'])(event);
    if (authError) return authError;

    const body = JSON.parse(event.body || '{}');
    const validationResult = ReviewSchema.safeParse(body);

    if (!validationResult.success) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'Validation error',
          errors: validationResult.error.errors,
          status: 'error'
        })
      };
    }

    const reviewData = validationResult.data;
    const userId = event.user?.userId;

    // Start a transaction
    const client = await query('BEGIN');
    try {
      // Update geological log status
      const logResult = await query(
        `UPDATE geological_log 
         SET 
           checked_by = $1,
           special_observations = CASE 
             WHEN $2 IS NOT NULL THEN COALESCE(special_observations || E'\\n', '') || $2
             ELSE special_observations
           END,
           updated_at = NOW()
         WHERE borelog_id = $3
         RETURNING *`,
        [userId, reviewData.comments, reviewData.borelog_id]
      );

      if (logResult.length === 0) {
        await query('ROLLBACK');
        return {
          statusCode: 404,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            message: 'Geological log not found',
            status: 'error'
          })
        };
      }

      // Record anomalies if any
      if (reviewData.anomalies && reviewData.anomalies.length > 0) {
        for (const anomaly of reviewData.anomalies) {
          await query(
            `INSERT INTO anomalies (
              anomaly_id, borelog_id, type, description, severity, 
              flagged_by_user_id, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [
              uuidv4(),
              reviewData.borelog_id,
              anomaly.type,
              anomaly.description,
              anomaly.severity,
              userId
            ]
          );
        }
      }

      await query('COMMIT');

      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'Geological log reviewed successfully',
          data: {
            ...logResult[0],
            anomalies: reviewData.anomalies || []
          },
          status: 'success'
        })
      };
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Error reviewing geological log:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Internal server error',
        status: 'error'
      })
    };
  }
};

export const getLogsForReview = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authError = checkRole(['Approval Engineer'])(event);
    if (authError) return authError;

    // Get logs that haven't been checked yet
    const logs = await query(
      `SELECT * FROM geological_log 
       WHERE checked_by IS NULL 
       ORDER BY created_at ASC`,
      []
    );

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Logs pending review retrieved successfully',
        data: logs,
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error getting logs for review:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Internal server error',
        status: 'error'
      })
    };
  }
};

export const getAnomaliesByProject = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authError = checkRole(['Approval Engineer'])(event);
    if (authError) return authError;

    const projectName = event.queryStringParameters?.project_name;
    if (!projectName) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'Project name is required',
          status: 'error'
        })
      };
    }

    // Get all anomalies for logs in the project
    const anomalies = await query(
      `SELECT a.*, gl.project_name, gl.borehole_number
       FROM anomalies a
       INNER JOIN geological_log gl ON a.borelog_id = gl.borelog_id
       WHERE gl.project_name = $1
       ORDER BY a.created_at DESC`,
      [projectName]
    );

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Anomalies retrieved successfully',
        data: anomalies,
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error getting anomalies:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'Internal server error',
        status: 'error'
      })
    };
  }
}; 