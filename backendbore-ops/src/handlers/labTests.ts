import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger } from '../utils/logger';
import { createResponse } from '../types/common';
import { createStorageClient } from '../storage/s3Client';

export const createLabTest = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('createLabTest');
  if (dbGuard) return dbGuard;

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Lab Engineer'])(event);
    if (authError) {
      return authError;
    }

    // Get user info from token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = await validateToken(authHeader!);
    if (!payload) {
      return createResponse(401, {
        success: false,
        message: 'Unauthorized: Invalid token',
        error: 'Invalid token'
      });
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.borelog_id || !body.test_type || !body.result) {
      return createResponse(400, {
        success: false,
        message: 'Missing required fields',
        error: 'borelog_id, test_type, and result are required'
      });
    }

    // Check if borelog exists
    const borelogQuery = `
      SELECT b.*, p.name as project_name, bd.number as borehole_number
      FROM boreloge b 
      JOIN projects p ON b.project_id = p.project_id
      LEFT JOIN borelog_details bd ON b.borelog_id = bd.borelog_id
      WHERE b.borelog_id = $1
    `;
    const borelogResult = await db.query(borelogQuery, [body.borelog_id]);
    
    if (borelogResult.length === 0) {
      return createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: 'Borelog with the specified ID does not exist'
      });
    }

    const borelog = borelogResult[0];
    const testId = uuidv4();

    // Create lab test record
    const createQuery = `
      INSERT INTO lab_test_results (
        test_id, assignment_id, sample_id, test_type, test_date, 
        results, technician, status, remarks, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      testId,
      body.assignment_id || null,
      body.sample_id || 'Unknown',
      body.test_type,
      body.test_date || new Date().toISOString(),
      JSON.stringify(body.result),
      payload.userId,
      body.status || 'pending',
      body.remarks || null
    ];

    const result = await db.query(createQuery, values);
    
    logger.info('Lab test created successfully', { testId, borelogId: body.borelog_id });

    return createResponse(201, {
      success: true,
      message: 'Lab test created successfully',
      data: {
        ...result[0],
        borelog: {
          borehole_number: borelog.borehole_number,
          project_name: borelog.project_name,
          chainage: borelog.chainage || 'N/A'
        }
      }
    });
  } catch (error) {
    logger.error('Error creating lab test:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create lab test'
    });
  }
};

/**
 * List lab tests - derive from approved borelogs with samples (S3-only)
 */
async function listLabTestsFromS3(
  storageClient: ReturnType<typeof createStorageClient>,
  userId: string,
  userRole: string
): Promise<any[]> {
  try {
    const allKeys = await storageClient.listFiles('projects/', 50000);
    
    // Find all borelog metadata files
    const metadataKeys = allKeys.filter(
      (k) => k.endsWith('/metadata.json') && 
             k.includes('/borelogs/borelog_') && 
             !k.includes('/versions/') && 
             !k.includes('/parsed/')
    );

    const labTests: any[] = [];

    // Process each borelog
    for (const metadataKey of metadataKeys) {
      try {
        // Extract project_id and borelog_id from path
        const pathMatch = metadataKey.match(/projects\/project_([^/]+)\/borelogs\/borelog_([^/]+)\/metadata\.json/);
        if (!pathMatch) continue;

        const [, projectId, borelogId] = pathMatch;

        // Read workflow.json to check if approved
        const workflowKey = `projects/project_${projectId}/borelogs/borelog_${borelogId}/workflow.json`;
        let workflow: any = null;
        
        if (await storageClient.fileExists(workflowKey)) {
          try {
            const workflowBuffer = await storageClient.downloadFile(workflowKey);
            workflow = JSON.parse(workflowBuffer.toString('utf-8'));
          } catch (error) {
            logger.warn('Error reading workflow.json', { workflowKey, error });
            continue;
          }
        } else {
          // Skip if no workflow (not approved)
          continue;
        }

        // Only process approved borelogs
        const status = workflow?.status?.toUpperCase();
        if (status !== 'APPROVED') {
          continue;
        }

        // Read project metadata
        let projectName: string | undefined;
        let boreholeNumber: string | undefined;
        try {
          const projectKey = `projects/project_${projectId}/project.json`;
          if (await storageClient.fileExists(projectKey)) {
            const projectBuffer = await storageClient.downloadFile(projectKey);
            const projectData = JSON.parse(projectBuffer.toString('utf-8'));
            projectName = projectData.name;
          }

          const metadataBuffer = await storageClient.downloadFile(metadataKey);
          const metadata = JSON.parse(metadataBuffer.toString('utf-8'));
          boreholeNumber = metadata.borehole_number || metadata.number;
        } catch (error) {
          logger.warn('Error reading project/borelog metadata', { projectId, borelogId, error });
        }

        // Find parsed strata files (check all versions)
        const versionKeys = allKeys.filter(k => 
          k.includes(`/borelog_${borelogId}/parsed/v`) && 
          k.endsWith('/strata.json')
        );

        for (const strataKey of versionKeys) {
          try {
            // Extract version number
            const versionMatch = strataKey.match(/\/parsed\/v(\d+)\/strata\.json/);
            if (!versionMatch) continue;
            const versionNo = parseInt(versionMatch[1], 10);

            // Read parsed strata
            const strataBuffer = await storageClient.downloadFile(strataKey);
            const parsedData = JSON.parse(strataBuffer.toString('utf-8'));

            // Extract samples from all strata
            const allSamples: any[] = [];
            (parsedData.strata || []).forEach((stratum: any) => {
              (stratum.samples || []).forEach((sample: any) => {
                allSamples.push({
                  ...sample,
                  stratum_description: stratum.description,
                  version_no: versionNo
                });
              });
            });

            // Check for lab results
            const labResultsKey = `projects/project_${projectId}/borelogs/borelog_${borelogId}/lab/results.json`;
            let labResults: any = null;
            if (await storageClient.fileExists(labResultsKey)) {
              try {
                const resultsBuffer = await storageClient.downloadFile(labResultsKey);
                labResults = JSON.parse(resultsBuffer.toString('utf-8'));
              } catch (error) {
                logger.warn('Error reading lab results', { labResultsKey, error });
              }
            }

            // Create lab test entries for samples that need testing
            // A sample needs testing if it has sample_code or sample_type indicating lab work
            allSamples.forEach((sample) => {
              const sampleId = sample.id || sample.sample_code || `sample-${allSamples.indexOf(sample)}`;
              const sampleCode = sample.sample_code || sampleId;

              // Check if this sample has lab results
              let testResult: any = null;
              let testStatus = 'pending';
              let testedBy: string | undefined;
              let testDate: string | undefined;
              let remarks: string | undefined;

              if (labResults && Array.isArray(labResults)) {
                const sampleResult = labResults.find((r: any) => 
                  r.sample_id === sampleId || 
                  r.sample_code === sampleCode ||
                  r.sample_id === sample.id
                );
                if (sampleResult) {
                  testResult = sampleResult.result || sampleResult.results;
                  testStatus = sampleResult.status || 'completed';
                  testedBy = sampleResult.tested_by || sampleResult.technician;
                  testDate = sampleResult.test_date || sampleResult.created_at;
                  remarks = sampleResult.remarks;
                }
              }

              // Determine test type from sample
              const testType = sample.test_type || 
                             (sample.sample_type === 'UNDISTURBED' ? 'Undisturbed Sample Test' : 
                              sample.sample_type === 'DISTURBED' ? 'Disturbed Sample Test' : 
                              'Lab Test');

              labTests.push({
                id: `${borelogId}-${sampleId}-${versionNo}`,
                borelog_id: borelogId,
                test_type: testType,
                result: testResult,
                tested_by: testedBy,
                test_date: testDate,
                remarks: remarks,
                status: testStatus,
                borelog: {
                  borehole_number: boreholeNumber || 'N/A',
                  project_name: projectName || projectId,
                  chainage: 'N/A'
                }
              });
            });
          } catch (error) {
            logger.warn('Error processing parsed strata', { strataKey, error });
            continue;
          }
        }
      } catch (error) {
        logger.warn('Error processing borelog for lab tests', { metadataKey, error });
        continue;
      }
    }

    // Filter by user role
    // Note: Project Manager filtering by project assignment would require user_project_assignments
    // which is not available in S3 mode. For now, Lab Engineers see only their tests.
    let filteredTests = labTests;
    if (userRole === 'Lab Engineer') {
      // Filter by tested_by matching userId (if available)
      filteredTests = labTests.filter(test => 
        !test.tested_by || test.tested_by === userId
      );
    }
    // Admin and Project Manager see all tests

    // Sort by test_date descending (most recent first)
    filteredTests.sort((a, b) => {
      const dateA = a.test_date ? new Date(a.test_date).getTime() : 0;
      const dateB = b.test_date ? new Date(b.test_date).getTime() : 0;
      return dateB - dateA;
    });

    return filteredTests;
  } catch (error) {
    logger.error('Error listing lab tests from S3', { error });
    return [];
  }
}

export const listLabTests = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Lab Engineer', 'Project Manager'])(event);
    if (authError) {
      return authError;
    }

    // Get user info from token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = await validateToken(authHeader!);
    if (!payload) {
      return createResponse(401, {
        success: false,
        message: 'Unauthorized: Invalid token',
        error: 'Invalid token'
      });
    }

    const storageClient = createStorageClient();
    const labTests = await listLabTestsFromS3(
      storageClient,
      payload.userId,
      payload.role
    );

    return createResponse(200, {
      success: true,
      message: 'Lab tests retrieved successfully',
      data: labTests
    });
  } catch (error) {
    logger.error('Error listing lab tests:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve lab tests'
    });
  }
};
