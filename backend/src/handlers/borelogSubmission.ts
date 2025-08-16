import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { z } from 'zod';
import * as db from '../db';

// Borelog Submission Schema
const BorelogSubmissionSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  structure_id: z.string().uuid('Invalid structure ID'),
  borehole_id: z.string().uuid('Invalid borehole ID'),
  version_number: z.number().min(1, 'Version number must be at least 1'),
  edited_by: z.string().uuid('Invalid user ID'),
  form_data: z.object({
    rows: z.array(z.object({
      id: z.string(),
      fields: z.array(z.object({
        id: z.string(),
        name: z.string(),
        value: z.union([z.string(), z.number(), z.null()]),
        fieldType: z.enum(['manual', 'calculated', 'auto-filled']),
        isRequired: z.boolean(),
        validation: z.object({
          min: z.number().optional(),
          max: z.number().optional(),
          pattern: z.string().optional()
        }).optional(),
        calculation: z.string().optional(),
        dependencies: z.array(z.string()).optional()
      })),
      description: z.string().optional(),
      isSubdivision: z.boolean().optional(),
      parentRowId: z.string().optional()
    })),
    metadata: z.object({
      project_name: z.string().min(1, 'Project name is required'),
      borehole_number: z.string().min(1, 'Borehole number is required'),
      commencement_date: z.string().min(1, 'Commencement date is required'),
      completion_date: z.string().min(1, 'Completion date is required'),
      standing_water_level: z.number().optional(),
      termination_depth: z.number().min(0, 'Termination depth must be positive')
    })
  }),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected'])
});

export const submitBorelog = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has Site Engineer role
    const authError = await checkRole(['Site Engineer', 'Admin', 'Project Manager'])(event);
    if (authError !== null) {
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

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validationResult = BorelogSubmissionSchema.safeParse(body);
    
    if (!validationResult.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation error',
        error: validationResult.error.errors
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const submissionData = validationResult.data;

    // Check if user has access to the project
    const projectAccessQuery = `
      SELECT 1 FROM user_assignments 
      WHERE user_id = $1 AND project_id = $2
    `;
    const projectAccess = await db.query(projectAccessQuery, [payload.userId, submissionData.project_id]);
    
    if (projectAccess.rows.length === 0 && payload.role !== 'Admin') {
      const response = createResponse(403, {
        success: false,
        message: 'Access denied: User not assigned to this project',
        error: 'Insufficient permissions'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get the latest version number for this borehole
    const latestVersionQuery = `
      SELECT COALESCE(MAX(version_number), 0) as latest_version
      FROM borelog_submissions 
      WHERE project_id = $1 AND structure_id = $2 AND borehole_id = $3
    `;
    const latestVersionResult = await db.query(latestVersionQuery, [
      submissionData.project_id,
      submissionData.structure_id,
      submissionData.borehole_id
    ]);
    
    const latestVersion = latestVersionResult.rows[0]?.latest_version || 0;
    
    // Validate version number
    if (submissionData.version_number <= latestVersion) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid version number',
        error: `Version number must be greater than ${latestVersion}`
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Insert the submission
    const insertQuery = `
      INSERT INTO borelog_submissions (
        submission_id,
        project_id,
        structure_id,
        borehole_id,
        version_number,
        edited_by,
        timestamp,
        form_data,
        status
      ) VALUES (
        gen_random_uuid(),
        $1, $2, $3, $4, $5, NOW(), $6, $7
      ) RETURNING submission_id, timestamp
    `;

    const insertResult = await db.query(insertQuery, [
      submissionData.project_id,
      submissionData.structure_id,
      submissionData.borehole_id,
      submissionData.version_number,
      submissionData.edited_by,
      JSON.stringify(submissionData.form_data),
      submissionData.status
    ]);

    const newSubmission = insertResult.rows[0];

    const response = createResponse(201, {
      success: true,
      message: 'Borelog submission created successfully',
      data: {
        submission_id: newSubmission.submission_id,
        version_number: submissionData.version_number,
        timestamp: newSubmission.timestamp,
        status: submissionData.status
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error submitting borelog:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to submit borelog'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

export const getBorelogSubmissions = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Site Engineer', 'Admin', 'Project Manager', 'Approval Engineer'])(event);
    if (authError !== null) {
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

    const projectId = event.pathParameters?.projectId;
    const boreholeId = event.pathParameters?.boreholeId;

    if (!projectId || !boreholeId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing project ID or borehole ID',
        error: 'Both projectId and boreholeId are required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Check if user has access to the project
    const projectAccessQuery = `
      SELECT 1 FROM user_assignments 
      WHERE user_id = $1 AND project_id = $2
    `;
    const projectAccess = await db.query(projectAccessQuery, [payload.userId, projectId]);
    
    if (projectAccess.rows.length === 0 && payload.role !== 'Admin') {
      const response = createResponse(403, {
        success: false,
        message: 'Access denied: User not assigned to this project',
        error: 'Insufficient permissions'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get submissions for the borehole
    const submissionsQuery = `
      SELECT 
        submission_id,
        project_id,
        structure_id,
        borehole_id,
        version_number,
        edited_by,
        timestamp,
        form_data,
        status
      FROM borelog_submissions 
      WHERE project_id = $1 AND borehole_id = $2
      ORDER BY version_number DESC
    `;

    const submissionsResult = await db.query(submissionsQuery, [projectId, boreholeId]);

    const response = createResponse(200, {
      success: true,
      message: 'Borelog submissions retrieved successfully',
      data: submissionsResult.rows
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error getting borelog submissions:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve borelog submissions'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

export const getBorelogSubmission = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Site Engineer', 'Admin', 'Project Manager', 'Approval Engineer'])(event);
    if (authError !== null) {
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

    const submissionId = event.pathParameters?.submissionId;

    if (!submissionId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing submission ID',
        error: 'submissionId is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get the submission
    const submissionQuery = `
      SELECT 
        submission_id,
        project_id,
        structure_id,
        borehole_id,
        version_number,
        edited_by,
        timestamp,
        form_data,
        status
      FROM borelog_submissions 
      WHERE submission_id = $1
    `;

    const submissionResult = await db.query(submissionQuery, [submissionId]);

    if (submissionResult.rows.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog submission not found',
        error: 'Submission does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const submission = submissionResult.rows[0];

    // Check if user has access to the project
    const projectAccessQuery = `
      SELECT 1 FROM user_assignments 
      WHERE user_id = $1 AND project_id = $2
    `;
    const projectAccess = await db.query(projectAccessQuery, [payload.userId, submission.project_id]);
    
    if (projectAccess.rows.length === 0 && payload.role !== 'Admin') {
      const response = createResponse(403, {
        success: false,
        message: 'Access denied: User not assigned to this project',
        error: 'Insufficient permissions'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const response = createResponse(200, {
      success: true,
      message: 'Borelog submission retrieved successfully',
      data: submission
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error getting borelog submission:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve borelog submission'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};
