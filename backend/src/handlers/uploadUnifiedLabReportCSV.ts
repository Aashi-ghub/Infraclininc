import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import * as db from '../db';
import { v4 as uuidv4 } from 'uuid';

// Header hints to auto-detect soil/rock presence and extract values
const SOIL_HEADERS = ['soil classification','moisture content','liquid limit','plastic limit','plasticity index','fines','sieve'];
const ROCK_HEADERS = ['rock ucs','ucs','point load','point load index','density','water absorption'];

// CSV schema (very relaxed). We'll enforce required-at-insert fields at runtime.
const UnifiedLabReportCSVSchema = z.object({
	assignment_id: z.string().optional(),
	borelog_id: z.string().optional(),
	sample_id: z.string().optional(),
	project_name: z.string().optional().default(''),
	borehole_no: z.string().optional().default(''),
	client: z.string().optional().default(''),
	test_date: z.string().optional(),
	tested_by: z.string().optional().default(''),
	checked_by: z.string().optional().default(''),
	approved_by: z.string().optional().default(''),
	test_types: z.string().optional().default(''),
	soil_test_data: z.string().optional().default('[]'),
	rock_test_data: z.string().optional().default('[]'),
	status: z.string().optional().default('draft'),
	remarks: z.string().optional().default(''),
});

type CsvRow = z.infer<typeof UnifiedLabReportCSVSchema>;

// Helpers to normalize incoming row fields (accept any UUID version)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v?: string) => !!(v && UUID_REGEX.test(String(v).trim()));

const pickFirst = (objLower: Record<string, any>, candidates: string[]): any => {
	for (const c of candidates) {
		if (c in objLower && objLower[c] != null && String(objLower[c]).trim() !== '') return objLower[c];
	}
	return undefined;
};

const normalizeRowFields = (
	row: Record<string, any>,
	defaults: { assignment_id?: string; borelog_id?: string }
): Record<string, any> => {
	const normalized: Record<string, any> = { ...row };
	const lower: Record<string, any> = {};
	for (const [k, v] of Object.entries(row)) lower[k.trim().toLowerCase()] = v;

	// sample_id aliases
	if (!normalized.sample_id) {
		normalized.sample_id = pickFirst(lower, ['sample_id','sample id','sample no','sample number','sample','lab sample id']);
	}
	// test_date aliases
	if (!normalized.test_date) {
		normalized.test_date = pickFirst(lower, ['test_date','test date','date of test','date','testing date']);
	}
	// borelog_id: prefer explicit, else aliases, else default
	const borelogCandidate = normalized.borelog_id || pickFirst(lower, ['borelog_id','borelog id','borelog','borehole id','borehole_uuid','borelog_uuid']) || defaults.borelog_id;
	normalized.borelog_id = borelogCandidate;
	// assignment_id: ignore non-uuid and prefer default if provided
	let assignmentCandidate = normalized.assignment_id || pickFirst(lower, ['assignment_id','assignment id','assignment','assignment_uuid']);
	if (!isUuid(assignmentCandidate)) assignmentCandidate = undefined;
	if (!assignmentCandidate && isUuid(defaults.assignment_id)) assignmentCandidate = defaults.assignment_id;
	normalized.assignment_id = assignmentCandidate;

	return normalized;
};

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
		const { csvData, sheets, default_assignment_id, default_borelog_id } = requestBody;

		// Enforce request-level defaults so each row inherits them
		if (!isUuid(default_borelog_id)) {
			const response = createResponse(400, {
				success: false,
				message: 'default_borelog_id (UUID) is required',
				error: 'default_borelog_id missing or invalid'
			});
			logResponse(response, Date.now() - startTime);
			return response;
		}
		// assignment_id is optional - can be null for drafts

		if ((!csvData || typeof csvData !== 'string') && !Array.isArray(sheets)) {
			const response = createResponse(400, {
				success: false,
				message: 'csvData is required (string contents of CSV file) or sheets array',
				error: 'csvData missing'
			});
			logResponse(response, Date.now() - startTime);
			return response;
		}

		// Build datasets from main CSV and optional Excel sheets
		const datasets: Array<{ name: string; rows: Record<string, string>[] }> = [];
		const parseCsvToRows = (csv: string) => (
			parse(csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[]
		);

		if (typeof csvData === 'string' && csvData.trim().length > 0) {
			datasets.push({ name: 'default', rows: parseCsvToRows(csvData) });
		}
		if (Array.isArray(sheets)) {
			for (const s of sheets) {
				if (s?.csv && typeof s.csv === 'string') {
					datasets.push({ name: s.name || 'sheet', rows: parseCsvToRows(s.csv) });
				}
			}
		}

		if (datasets.length === 0) {
			const response = createResponse(400, {
				success: false,
				message: 'No CSV content provided',
				error: 'No rows'
			});
			logResponse(response, Date.now() - startTime);
			return response;
		}

		const results: Array<{ row: number; report_id?: string; error?: string; sheet?: string }> = [];
		let successful = 0;
		let failed = 0;
		let total = 0;

		// Collect all sample data from ALL sheets into unified arrays
		const allSoilData: any[] = [];
		const allRockData: any[] = [];
		let reportMetadata: any = {};
		let hasValidSamples = false;
		let totalProcessedRows = 0;

		// Process each dataset (sheet) and collect data
		for (const dataset of datasets) {
			const records = dataset.rows;
			if (!records.length) continue;
			
			const headers = Object.keys(records[0] || {});
			logger.info('Processing sheet for unified report', { 
				sheet: dataset.name, 
				headerCount: headers.length, 
				headers, 
				totalRows: records.length, 
				sampleRows: records.slice(0, Math.min(3, records.length)),
				firstRowKeys: Object.keys(records[0] || {}),
				firstRowValues: Object.values(records[0] || {})
			});

			// First pass: collect metadata and identify sample rows
			for (let i = 0; i < records.length; i++) {
				const rowIndex = i + 2; // considering header row is line 1
				try {
					const raw = records[i];
					
					// Skip completely empty rows
					const hasData = Object.values(raw).some(v => v && String(v).trim() !== '');
					if (!hasData) continue;
					
					// Skip obvious metadata rows (first few rows with project info)
					if (i < 10) {
						const isMetadataRow = Object.keys(raw).some(key => {
							const lowerKey = key.toLowerCase();
							return lowerKey.includes('project') || 
								   lowerKey.includes('client') || 
								   lowerKey.includes('loa') || 
								   lowerKey.includes('section') ||
								   lowerKey.includes('borehole') ||
								   lowerKey.includes('location') ||
								   lowerKey.includes('date') ||
								   lowerKey.includes('tested by') ||
								   lowerKey.includes('checked by') ||
								   lowerKey.includes('approved by');
						});
						
						// If it's a metadata row, collect the info but don't treat as sample data
						if (isMetadataRow) {
							// Extract metadata for the report
							for (const [key, value] of Object.entries(raw)) {
								if (value && String(value).trim() !== '') {
									const lowerKey = key.toLowerCase();
									if (lowerKey.includes('project') && !reportMetadata.project_name) {
										reportMetadata.project_name = String(value).trim();
									} else if (lowerKey.includes('client') && !reportMetadata.client) {
										reportMetadata.client = String(value).trim();
									} else if (lowerKey.includes('borehole') && !reportMetadata.borehole_no) {
										reportMetadata.borehole_no = String(value).trim();
									}
								}
							}
							continue; // Skip this row for sample processing
						}
					}
					
					// Normalize aliases, apply defaults, and ignore invalid UUIDs
					const normalizedInput = normalizeRowFields(raw, {
						assignment_id: default_assignment_id,
						borelog_id: default_borelog_id,
					});
					
					// Log raw row data for debugging
					logger.info('Processing row', { 
						sheet: dataset.name, 
						rowIndex, 
						rawData: raw,
						normalizedData: normalizedInput,
						keys: Object.keys(raw),
						values: Object.values(raw)
					});
					
					const parsedInput = UnifiedLabReportCSVSchema.partial().parse(normalizedInput) as Partial<CsvRow>;
					
					// Apply defaults from request for every row
					let parsed = UnifiedLabReportCSVSchema.parse({
						assignment_id: isUuid(default_assignment_id) ? default_assignment_id : undefined,
						borelog_id: default_borelog_id,
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

					// Auto-generate missing essentials
					if (!parsed.sample_id || String(parsed.sample_id).trim() === '') {
						parsed = { ...parsed, sample_id: uuidv4() } as CsvRow;
					}
					if (!parsed.test_date || String(parsed.test_date).trim() === '') {
						parsed = { ...parsed, test_date: new Date().toISOString() } as CsvRow;
					}

					// Build soil/rock objects from arbitrary header columns if JSON not provided
					const lowerKeyed = Object.fromEntries(Object.entries(raw).map(([k,v]) => [k.trim().toLowerCase(), v]));

					const soilObj: Record<string, any> = {};
					const rockObj: Record<string, any> = {};

					for (const [kLower, v] of Object.entries(lowerKeyed)) {
						if (SOIL_HEADERS.some(h => kLower.includes(h))) {
							soilObj[kLower] = isNaN(Number(v as string)) ? v : Number(v);
						}
						if (ROCK_HEADERS.some(h => kLower.includes(h))) {
							rockObj[kLower] = isNaN(Number(v as string)) ? v : Number(v);
						}
					}

					// Parse JSON arrays if provided; otherwise use built objects
					let soilData: any[] = [];
					let rockData: any[] = [];
					try {
						soilData = parsed.soil_test_data ? JSON.parse(parsed.soil_test_data) : [];
					} catch (e) {
						logger.warn('Invalid soil_test_data JSON at row', { rowIndex, sheet: dataset.name });
					}
					try {
						rockData = parsed.rock_test_data ? JSON.parse(parsed.rock_test_data) : [];
					} catch (e) {
						logger.warn('Invalid rock_test_data JSON at row', { rowIndex, sheet: dataset.name });
					}

					if (soilData.length === 0 && Object.keys(soilObj).length > 0) soilData = [soilObj];
					if (rockData.length === 0 && Object.keys(rockObj).length > 0) rockData = [rockObj];



					// Check if this row has actual test data (not just metadata)
					// Look for numerical values in the row that indicate test data
					const hasNumericalData = Object.values(raw).some(v => {
						if (!v || typeof v !== 'string') return false;
						const trimmed = String(v).trim();
						// Check if it's a number (including decimals, negative numbers)
						return /^-?\d+(\.\d+)?$/.test(trimmed) && trimmed !== '';
					});

					// Check for test-related headers in the row
					const hasTestHeaders = Object.keys(raw).some(key => {
						const lowerKey = key.toLowerCase();
						return lowerKey.includes('sample') || 
							   lowerKey.includes('test') || 
							   lowerKey.includes('load') || 
							   lowerKey.includes('strength') || 
							   lowerKey.includes('density') || 
							   lowerKey.includes('diameter') || 
							   lowerKey.includes('weight') || 
							   lowerKey.includes('volume') || 
							   lowerKey.includes('content') || 
							   lowerKey.includes('porosity') ||
							   lowerKey.includes('ucs') ||
							   lowerKey.includes('mpa') ||
							   lowerKey.includes('kn');
					});

					const hasTestData = soilData.length > 0 || rockData.length > 0 || 
						Object.keys(soilObj).length > 0 || Object.keys(rockObj).length > 0 ||
						hasNumericalData || hasTestHeaders;

					if (hasTestData) {
						hasValidSamples = true;
						
						// Log what we found for debugging
						if (i < 5) {
							logger.info('Found test data in row', { 
								sheet: dataset.name, 
								rowIndex, 
								hasNumericalData, 
								hasTestHeaders,
								soilDataLength: soilData.length,
								rockDataLength: rockData.length,
								soilObjKeys: Object.keys(soilObj).length,
								rockObjKeys: Object.keys(rockObj).length
							});
						}
						
						// Add sample data to collections
						if (soilData.length > 0) allSoilData.push(...soilData);
						if (rockData.length > 0) allRockData.push(...rockData);
						
						// If no JSON data but we have extracted objects, add them
						if (soilData.length === 0 && Object.keys(soilObj).length > 0) {
							allSoilData.push(soilObj);
						}
						if (rockData.length === 0 && Object.keys(rockObj).length > 0) {
							allRockData.push(rockObj);
						}

						// If we have numerical data but no structured objects, create a sample object
						if (soilData.length === 0 && rockData.length === 0 && 
							Object.keys(soilObj).length === 0 && Object.keys(rockObj).length === 0 &&
							hasNumericalData) {
							// Create a sample object from the raw data
							const sampleObj: Record<string, any> = {};
							for (const [key, value] of Object.entries(raw)) {
								if (value && String(value).trim() !== '') {
									const numValue = Number(value);
									if (!isNaN(numValue)) {
										sampleObj[key.trim()] = numValue;
									} else {
										sampleObj[key.trim()] = value;
									}
								}
							}
							
							// Determine if it's soil or rock based on headers
							const isRockData = Object.keys(raw).some(key => 
								key.toLowerCase().includes('rock') || 
								key.toLowerCase().includes('ucs') || 
								key.toLowerCase().includes('compressive') ||
								key.toLowerCase().includes('tensile') ||
								key.toLowerCase().includes('point load')
							);
							
							if (isRockData) {
								allRockData.push(sampleObj);
								logger.info('Added rock sample from numerical data', { sheet: dataset.name, rowIndex, sampleKeys: Object.keys(sampleObj) });
							} else {
								allSoilData.push(sampleObj);
								logger.info('Added soil sample from numerical data', { sheet: dataset.name, rowIndex, sampleKeys: Object.keys(sampleObj) });
							}
						}
					}

					// Ensure we have a borelog_id after defaults
					if (!parsed.borelog_id) {
						throw new Error('borelog_id is required (provide in CSV or set default_borelog_id)');
					}

				} catch (validationError: any) {
					failed += 1;
					const message = validationError?.errors?.map((e: any) => e.message).join('; ') || validationError?.message || 'Validation error';
					results.push({ row: rowIndex, error: message, sheet: dataset.name });
				}
			}
		}

		// Log collected data for debugging
		logger.info('Collected data summary:', {
			hasValidSamples,
			allSoilDataLength: allSoilData.length,
			allRockDataLength: allRockData.length,
			reportMetadata,
			allSoilData: allSoilData.slice(0, 2), // Log first 2 samples
			allRockData: allRockData.slice(0, 2)  // Log first 2 samples
		});

		// Create ONE unified report with all collected sample data from ALL sheets
		if (hasValidSamples) {
			try {
				const pool = await db.getPool();
				const client = await pool.connect();
				try {
					await client.query('BEGIN');

					const reportId = uuidv4();
					
					// Determine test types based on collected data
					const testTypes: string[] = [];
					if (allSoilData.length > 0) testTypes.push('Soil');
					if (allRockData.length > 0) testTypes.push('Rock');

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
						isUuid(default_assignment_id) ? default_assignment_id : null,
						default_borelog_id,
						uuidv4(), // Generate sample_id for the report
						reportMetadata.project_name || '',
						reportMetadata.borehole_no || '',
						reportMetadata.client || '',
						new Date().toISOString(),
						'', // tested_by
						'', // checked_by
						'', // approved_by
						JSON.stringify(testTypes),
						'[]', // Empty JSON array for soil_test_data (now stored in separate table)
						'[]', // Empty JSON array for rock_test_data (now stored in separate table)
						'submitted',
						`Unified lab report with ${allSoilData.length} soil samples and ${allRockData.length} rock samples`,
						payload.userId,
					]);

					// Insert soil test samples into separate table
					logger.info('Inserting soil samples:', { count: allSoilData.length });
					if (allSoilData.length > 0) {
						for (let i = 0; i < allSoilData.length; i++) {
							const soilSample = allSoilData[i];
							const soilSampleQuery = `
								INSERT INTO soil_test_samples (
									report_id, layer_no, sample_no, depth_from, depth_to,
									natural_moisture_content, bulk_density, dry_density, specific_gravity,
									void_ratio, porosity, degree_of_saturation,
									liquid_limit, plastic_limit, plasticity_index, shrinkage_limit,
									gravel_percentage, sand_percentage, silt_percentage, clay_percentage,
									cohesion, angle_of_internal_friction, unconfined_compressive_strength,
									compression_index, recompression_index, preconsolidation_pressure,
									permeability_coefficient, cbr_value,
									soil_classification, soil_description, remarks,
									created_by_user_id
								) VALUES (
									$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
									$17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
								)
							`;

							logger.info('Inserting soil sample:', { 
								index: i, 
								sampleData: soilSample,
								sampleKeys: Object.keys(soilSample)
							});
							
							await client.query(soilSampleQuery, [
								reportId,
								soilSample.layer_no || i + 1,
								soilSample.sample_no || `S-${i + 1}`,
								soilSample.depth_from || null,
								soilSample.depth_to || null,
								soilSample.natural_moisture_content || null,
								soilSample.bulk_density || null,
								soilSample.dry_density || null,
								soilSample.specific_gravity || null,
								soilSample.void_ratio || null,
								soilSample.porosity || null,
								soilSample.degree_of_saturation || null,
								soilSample.liquid_limit || null,
								soilSample.plastic_limit || null,
								soilSample.plasticity_index || null,
								soilSample.shrinkage_limit || null,
								soilSample.gravel_percentage || null,
								soilSample.sand_percentage || null,
								soilSample.silt_percentage || null,
								soilSample.clay_percentage || null,
								soilSample.cohesion || null,
								soilSample.angle_of_internal_friction || null,
								soilSample.unconfined_compressive_strength || null,
								soilSample.compression_index || null,
								soilSample.recompression_index || null,
								soilSample.preconsolidation_pressure || null,
								soilSample.permeability_coefficient || null,
								soilSample.cbr_value || null,
								soilSample.soil_classification || null,
								soilSample.soil_description || null,
								soilSample.remarks || null,
								payload.userId
							]);
						}
					}

					// Insert rock test samples into separate table
					logger.info('Inserting rock samples:', { count: allRockData.length });
					if (allRockData.length > 0) {
						for (let i = 0; i < allRockData.length; i++) {
							const rockSample = allRockData[i];
							const rockSampleQuery = `
								INSERT INTO rock_test_samples (
									report_id, layer_no, sample_no, depth_from, depth_to,
									natural_moisture_content, bulk_density, dry_density, specific_gravity,
									porosity, water_absorption,
									unconfined_compressive_strength, point_load_strength_index,
									tensile_strength, shear_strength,
									youngs_modulus, poissons_ratio,
									slake_durability_index, soundness_loss,
									los_angeles_abrasion_value,
									rock_classification, rock_description, rock_quality_designation, remarks,
									created_by_user_id
								) VALUES (
									$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
									$17, $18, $19, $20, $21, $22, $23, $24, $25
								)
							`;

							logger.info('Inserting rock sample:', { 
								index: i, 
								sampleData: rockSample,
								sampleKeys: Object.keys(rockSample)
							});
							
							await client.query(rockSampleQuery, [
								reportId,
								rockSample.layer_no || i + 1,
								rockSample.sample_no || `R-${i + 1}`,
								rockSample.depth_from || null,
								rockSample.depth_to || null,
								rockSample.natural_moisture_content || null,
								rockSample.bulk_density || null,
								rockSample.dry_density || null,
								rockSample.specific_gravity || null,
								rockSample.porosity || null,
								rockSample.water_absorption || null,
								rockSample.unconfined_compressive_strength || null,
								rockSample.point_load_strength_index || null,
								rockSample.tensile_strength || null,
								rockSample.shear_strength || null,
								rockSample.youngs_modulus || null,
								rockSample.poissons_ratio || null,
								rockSample.slake_durability_index || null,
								rockSample.soundness_loss || null,
								rockSample.los_angeles_abrasion_value || null,
								rockSample.rock_classification || null,
								rockSample.rock_description || null,
								rockSample.rock_quality_designation || null,
								rockSample.remarks || null,
								payload.userId
							]);
						}
					}

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
						isUuid(default_assignment_id) ? default_assignment_id : null,
						default_borelog_id,
						uuidv4(), // Generate sample_id for the version
						reportMetadata.project_name || '',
						reportMetadata.borehole_no || '',
						reportMetadata.client || '',
						new Date().toISOString(),
						'', // tested_by
						'', // checked_by
						'', // approved_by
						JSON.stringify(testTypes),
						'[]', // Empty JSON array for soil_test_data
						'[]', // Empty JSON array for rock_test_data
						'submitted',
						`Unified lab report with ${allSoilData.length} soil samples and ${allRockData.length} rock samples`,
						payload.userId,
					]);

					await client.query('COMMIT');
					
					logger.info('Successfully created report with samples:', {
						reportId,
						soilSamplesCount: allSoilData.length,
						rockSamplesCount: allRockData.length,
						totalSheets: datasets.length
					});
					
					successful += 1;
					results.push({ row: 0, report_id: reportId, sheet: 'unified' });
					logger.info('Created unified report from all sheets', { 
						reportId, 
						soilSamples: allSoilData.length, 
						rockSamples: allRockData.length,
						totalSheets: datasets.length
					});
				} catch (err: any) {
					await client.query('ROLLBACK');
					failed += 1;
					logger.error('Failed to create unified report', { error: err?.message });
					results.push({ row: 0, error: err?.message || 'Unknown error', sheet: 'unified' });
				} finally {
					client.release();
				}
			} catch (error: any) {
				failed += 1;
				logger.error('Failed to process unified report', { error: error?.message });
				results.push({ row: 0, error: error?.message || 'Unknown error', sheet: 'unified' });
			}
		} else {
			logger.warn('No valid sample data found in any sheet');
			results.push({ row: 0, error: 'No valid sample data found in any sheet', sheet: 'unified' });
		}

		const response = createResponse(200, {
			success: true,
			message: 'CSV processed',
			data: {
				summary: { successful, failed, total },
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


