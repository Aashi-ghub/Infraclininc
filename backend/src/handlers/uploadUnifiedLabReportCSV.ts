import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import * as db from '../db';
import { v4 as uuidv4 } from 'uuid';

// CSV schema for Unified Lab Reports bulk upload
const UnifiedLabReportCSVSchema = z.object({
  assignment_id: z.string().uuid('Invalid assignment_id').optional(),
  borelog_id: z.string().uuid('Invalid borelog_id'),
  sample_id: z.string().min(1, 'sample_id is required'),
  project_name: z.string().min(1, 'project_name is required'),
  borehole_no: z.string().min(1, 'borehole_no is required'),
  client: z.string().optional().default(''),
  test_date: z.string().min(1, 'test_date is required'),
  tested_by: z.string().min(1, 'tested_by is required'),
  checked_by: z.string().min(1, 'checked_by is required'),
  approved_by: z.string().min(1, 'approved_by is required'),
  test_types: z.string().min(1, 'test_types is required'), // e.g. "Soil;Rock"
  soil_test_data: z.string().optional().default('[]'), // JSON array string
  rock_test_data: z.string().optional().default('[]'), // JSON array string
  status: z.string().optional().default('draft'),
  remarks: z.string().optional().default(''),
});

type CsvRow = z.infer<typeof UnifiedLabReportCSVSchema>;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    const authError = await checkRole(['Admin', 'Project Manager', 'Lab Engineer'])(event);
    if (authError) {
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
    const { csvData, default_assignment_id, default_borelog_id } = requestBody;

    if (!csvData || typeof csvData !== 'string') {
      const response = createResponse(400, {
        success: false,
        message: 'csvData is required (string contents of CSV file)',
        error: 'csvData missing'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Parse CSV
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as Record<string, string>[];

    if (!records.length) {
      const response = createResponse(400, {
        success: false,
        message: 'CSV appears to be empty or missing headers',
        error: 'No rows'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const results: Array<{ row: number; report_id?: string; error?: string }> = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < records.length; i++) {
      const rowIndex = i + 2; // considering header row is line 1
      try {
        const parsedInput = UnifiedLabReportCSVSchema.partial().parse(records[i]) as Partial<CsvRow>;
        // Apply defaults when provided in request
        const parsed = UnifiedLabReportCSVSchema.parse({
          assignment_id: parsedInput.assignment_id || default_assignment_id,
          borelog_id: parsedInput.borelog_id || default_borelog_id,
          sample_id: parsedInput.sample_id,
          project_name: parsedInput.project_name,
          borehole_no: parsedInput.borehole_no,
          client: parsedInput.client ?? '',
          test_date: parsedInput.test_date,
          tested_by: parsedInput.tested_by,
          checked_by: parsedInput.checked_by,
          approved_by: parsedInput.approved_by,
          test_types: parsedInput.test_types || '',
          soil_test_data: parsedInput.soil_test_data ?? '[]',
          rock_test_data: parsedInput.rock_test_data ?? '[]',
          status: parsedInput.status ?? 'draft',
          remarks: parsedInput.remarks ?? ''
        }) as CsvRow;

        // Normalize fields
        const testTypes = parsed.test_types
          .split(/[,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);

        // Parse JSON arrays if provided
        let soilData: any[] = [];
        let rockData: any[] = [];
        try {
          soilData = parsed.soil_test_data ? JSON.parse(parsed.soil_test_data) : [];
        } catch (e) {
          logger.warn('Invalid soil_test_data JSON at row', { rowIndex });
        }
        try {
          rockData = parsed.rock_test_data ? JSON.parse(parsed.rock_test_data) : [];
        } catch (e) {
          logger.warn('Invalid rock_test_data JSON at row', { rowIndex });
        }

        const pool = await db.getPool();
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          const reportId = uuidv4();

          // Create minimal record in unified_lab_reports
          const createReportQuery = `
            INSERT INTO unified_lab_reports (
              report_id, assignment_id, borelog_id, sample_id, project_name, borehole_no,
              client, test_date, tested_by, checked_by, approved_by, test_types,
              soil_test_data, rock_test_data, status, remarks, created_by_user_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          `;

          await client.query(createReportQuery, [
            reportId,
            parsed.assignment_id || null,
            parsed.borelog_id,
            parsed.sample_id,
            parsed.project_name,
            parsed.borehole_no,
            parsed.client || '',
            new Date(parsed.test_date).toISOString(),
            parsed.tested_by,
            parsed.checked_by,
            parsed.approved_by,
            JSON.stringify(testTypes),
            JSON.stringify(soilData),
            JSON.stringify(rockData),
            'draft',
            parsed.remarks || '',
            payload.userId,
          ]);

          // Create initial version explicitly to ensure version history exists
          const versionResult = await client.query('SELECT get_next_lab_report_version($1) as next_version', [reportId]);
          const nextVersion = versionResult.rows?.[0]?.next_version ?? 1;

          const insertVersionQuery = `
            INSERT INTO lab_report_versions (
              report_id, version_no, assignment_id, borelog_id, sample_id, project_name, borehole_no,
              client, test_date, tested_by, checked_by, approved_by, test_types,
              soil_test_data, rock_test_data, status, remarks, created_by_user_id
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, $11, $12, $13,
              $14, $15, $16, $17, $18
            )
          `;

          await client.query(insertVersionQuery, [
            reportId,
            nextVersion,
            parsed.assignment_id || null,
            parsed.borelog_id,
            parsed.sample_id,
            parsed.project_name,
            parsed.borehole_no,
            parsed.client || '',
            new Date(parsed.test_date).toISOString(),
            parsed.tested_by,
            parsed.checked_by,
            parsed.approved_by,
            JSON.stringify(testTypes),
            JSON.stringify(soilData),
            JSON.stringify(rockData),
            'draft',
            parsed.remarks || '',
            payload.userId,
          ]);

          await client.query('COMMIT');
          successful += 1;
          results.push({ row: rowIndex, report_id: reportId });
        } catch (err: any) {
          await client.query('ROLLBACK');
          failed += 1;
          logger.error('Failed to process CSV row', { rowIndex, error: err?.message });
          results.push({ row: rowIndex, error: err?.message || 'Unknown error' });
        } finally {
          client.release();
        }
      } catch (validationError: any) {
        failed += 1;
        const message = validationError?.errors?.map((e: any) => e.message).join('; ') || validationError?.message || 'Validation error';
        results.push({ row: rowIndex, error: message });
      }
    }

    const response = createResponse(200, {
      success: true,
      message: 'CSV processed',
      data: {
        summary: { successful, failed, total: records.length },
        results,
      }
    });
    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error: any) {
    logger.error('Unexpected error during Unified Lab Report CSV upload', { error: error?.message });
    const response = createResponse(500, {
      success: false,
      message: 'Failed to process CSV',
      error: error?.message || 'Internal server error'
    });
    logResponse(response, Date.now() - startTime);
    return response;
  }
};

export default { handler };


