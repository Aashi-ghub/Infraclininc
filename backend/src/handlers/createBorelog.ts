import { APIGatewayProxyEvent } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { createResponse } from '../types/common';
import { logger, logRequest, logResponse } from '../utils/logger';
import { z } from 'zod';
import { createStorageClient } from '../storage/s3Client';
import { v4 as uuidv4 } from 'uuid';

// Borelog Creation Schema
const CreateBorelogSchema = z.object({
  substructure_id: z.string().uuid('Invalid substructure ID'),
  project_id: z.string().uuid('Invalid project ID'),
  type: z.enum(['Geotechnical', 'Geological']),
  // Borelog details fields
  number: z.string().optional(),
  msl: z.string().optional(),
  boring_method: z.string().optional(),
  hole_diameter: z.number().optional(),
  commencement_date: z.string().optional(),
  completion_date: z.string().optional(),
  standing_water_level: z.number().nullable().optional(),
  termination_depth: z.number().nullable().optional(),
  coordinate: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()])
  }).optional(),
  permeability_test_count: z.string().optional(),
  spt_vs_test_count: z.string().optional(),
  undisturbed_sample_count: z.string().optional(),
  disturbed_sample_count: z.string().optional(),
  water_sample_count: z.string().optional(),
  stratum_description: z.string().optional(),
  stratum_depth_from: z.number().optional(),
  stratum_depth_to: z.number().optional(),
  stratum_thickness_m: z.number().optional(),
  sample_event_type: z.string().optional(),
  sample_event_depth_m: z.number().optional(),
  run_length_m: z.number().optional(),
  spt_blows_per_15cm: z.number().optional(),
  n_value_is_2131: z.string().optional(),
  total_core_length_cm: z.number().optional(),
  tcr_percent: z.number().optional(),
  rqd_length_cm: z.number().optional(),
  rqd_percent: z.number().optional(),
  return_water_colour: z.string().optional(),
  water_loss: z.string().optional(),
  borehole_diameter: z.number().optional(),
  remarks: z.string().optional()
});

export const handler = async (event: APIGatewayProxyEvent) => {
  logger.info('[S3 CREATE ENABLED] createBorelog');

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
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

    if (!event.body) {
      const response = createResponse(400, {
        success: false,
        message: 'Request body is missing',
        error: 'Missing request body'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const data = JSON.parse(event.body);
    const validationResult = CreateBorelogSchema.safeParse(data);

    if (!validationResult.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation failed',
        error: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const borelogData = validationResult.data;

    // Verify substructure exists in S3
    const storageClient = createStorageClient();
    const substructureKey = `projects/project_${borelogData.project_id}/structures/structure_*/substructures/substructure_${borelogData.substructure_id}/substructure.json`;
    
    // Find the structure_id by searching for the substructure
    const allSubstructureKeys = await storageClient.listFiles(`projects/project_${borelogData.project_id}/structures/`, 10000);
    const substructureMatch = allSubstructureKeys.find(key => 
      key.includes(`substructure_${borelogData.substructure_id}/substructure.json`)
    );
    
    if (!substructureMatch) {
      const response = createResponse(404, {
        success: false,
        message: 'Substructure not found or does not belong to the specified project',
        error: 'Invalid substructure_id or project_id'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Check if borelog already exists for this substructure by searching for metadata files
    const borelogsPrefix = `projects/project_${borelogData.project_id}/borelogs/`;
    const allBorelogKeys = await storageClient.listFiles(borelogsPrefix, 10000);
    const metadataFiles = allBorelogKeys.filter(key => key.endsWith('/metadata.json'));
    
    let borelogId: string | null = null;
    let existingMetadata: any = null;
    
    // Check each metadata file to see if it belongs to this substructure
    for (const metadataKey of metadataFiles) {
      try {
        const metadataBuffer = await storageClient.downloadFile(metadataKey);
        const metadata = JSON.parse(metadataBuffer.toString('utf-8'));
        if (metadata.substructure_id === borelogData.substructure_id) {
          borelogId = metadata.borelog_id;
          existingMetadata = metadata;
          break;
        }
      } catch (error) {
        // Skip invalid metadata files
        continue;
      }
    }

    // Create new borelog if it doesn't exist
    if (!borelogId) {
      borelogId = uuidv4();
    }

    const createdAt = new Date().toISOString();
    const versionNo = existingMetadata ? (existingMetadata.latest_version || 0) + 1 : 1;

    // Create or update metadata
    const metadata = {
      project_id: borelogData.project_id,
      borelog_id: borelogId,
      substructure_id: borelogData.substructure_id,
      type: borelogData.type,
      latest_version: versionNo,
      created_by_user_id: payload.userId,
      created_at: existingMetadata?.created_at || createdAt,
      updated_at: createdAt,
      versions: existingMetadata?.versions || []
    };

    // Add new version entry
    metadata.versions.push({
      version: versionNo,
      status: 'submitted',
      created_by: payload.userId,
      created_at: createdAt,
      number: borelogData.number || null,
      msl: borelogData.msl || null,
      boring_method: borelogData.boring_method || null,
      hole_diameter: borelogData.hole_diameter || null,
      commencement_date: borelogData.commencement_date || null,
      completion_date: borelogData.completion_date || null,
      standing_water_level: borelogData.standing_water_level || null,
      termination_depth: borelogData.termination_depth || null,
      coordinate: borelogData.coordinate || null,
      permeability_test_count: borelogData.permeability_test_count || null,
      spt_vs_test_count: borelogData.spt_vs_test_count || null,
      undisturbed_sample_count: borelogData.undisturbed_sample_count || null,
      disturbed_sample_count: borelogData.disturbed_sample_count || null,
      water_sample_count: borelogData.water_sample_count || null,
      stratum_description: borelogData.stratum_description || null,
      stratum_depth_from: borelogData.stratum_depth_from || null,
      stratum_depth_to: borelogData.stratum_depth_to || null,
      stratum_thickness_m: borelogData.stratum_thickness_m || null,
      sample_event_type: borelogData.sample_event_type || null,
      sample_event_depth_m: borelogData.sample_event_depth_m || null,
      run_length_m: borelogData.run_length_m || null,
      spt_blows_per_15cm: borelogData.spt_blows_per_15cm || null,
      n_value_is_2131: borelogData.n_value_is_2131 || null,
      total_core_length_cm: borelogData.total_core_length_cm || null,
      tcr_percent: borelogData.tcr_percent || null,
      rqd_length_cm: borelogData.rqd_length_cm || null,
      rqd_percent: borelogData.rqd_percent || null,
      return_water_colour: borelogData.return_water_colour || null,
      water_loss: borelogData.water_loss || null,
      borehole_diameter: borelogData.borehole_diameter || null,
      remarks: borelogData.remarks || null
    });

    // Write metadata.json to S3
    const metadataKey = `projects/project_${borelogData.project_id}/borelogs/borelog_${borelogId}/metadata.json`;
    await storageClient.uploadFile(
      metadataKey,
      Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8'),
      'application/json'
    );

    // Create version details object for response
    const latestVersion = metadata.versions[metadata.versions.length - 1];
    const borelogDetails = {
      borelog_id: borelogId,
      version_no: versionNo,
      ...latestVersion
    };

    const response = createResponse(201, {
      success: true,
      message: 'Borelog created successfully',
      data: {
        borelog_id: borelogId,
        version_no: versionNo,
        borelog_details: borelogDetails
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error: any) {
    logger.error('[S3 VERIFY FAIL] createBorelog reason=', error.message || 'Unknown error');
    logger.error('Error creating borelog', { error });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create borelog'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};
