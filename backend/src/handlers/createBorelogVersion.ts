import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { guardDbRoute } from '../db';
import { validate as validateUUID } from 'uuid';
import { z } from 'zod';
import { convertScalarToRelational } from '../utils/stratumConverter';
import { saveStratumData } from '../utils/stratumSaver';
import { createStorageClient } from '../storage/s3Client';
import { parseBody } from '../utils/parseBody';

// Schema for creating new borelog versions
const CreateBorelogVersionSchema = z.object({
  borelog_id: z.string().uuid('Invalid borelog ID'),
  substructure_id: z.string().uuid('Invalid substructure ID'),
  project_id: z.string().uuid('Invalid project ID'),
  type: z.enum(['Geotechnical', 'Geological']),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
  version_no: z.number().optional(),
  number: z.string().optional(),
  msl: z.string().optional(),
  boring_method: z.string().optional(),
  hole_diameter: z.number().nullable().optional(),
  commencement_date: z.string().optional(),
  completion_date: z.string().optional(),
  standing_water_level: z.number().optional(),
  termination_depth: z.number().optional(),
  coordinate: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()])
  }).optional(),
  // Newly added optional fields for extended metadata
  job_code: z.string().optional(),
  location: z.string().optional(),
  chainage_km: z.union([z.string(), z.number()]).optional(),
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
  stratum_data: z.string().optional(),
  remarks: z.string().optional()
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Note: DB guard removed for this handler - it now works with S3-only storage
  // const dbGuard = guardDbRoute('createBorelogVersion');
  // if (dbGuard) return dbGuard;

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer'])(event);
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

    if (!event.body) {
      const response = createResponse(400, {
        success: false,
        message: 'Request body is missing',
        error: 'Missing request body'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const data = parseBody(event);
    if (!data) {
      return createResponse(400, { success: false, message: "Invalid JSON body" });
    }
    const validationResult = CreateBorelogVersionSchema.safeParse(data);

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

    // Initialize S3 storage client
    const storageClient = createStorageClient();

    // Resolve borelog location: prefer new path, fall back to legacy-prefixed path for compatibility
    const basePath = `projects/${borelogData.project_id}/borelogs/${borelogData.borelog_id}`;
    const legacyBasePath = `projects/project_${borelogData.project_id}/borelogs/borelog_${borelogData.borelog_id}`;
    const metadataNewKey = `${basePath}/metadata.json`;
    const metadataLegacyKey = `${legacyBasePath}/metadata.json`;
    const [metadataExists, legacyMetadataExists] = await Promise.all([
      storageClient.fileExists(metadataNewKey),
      storageClient.fileExists(metadataLegacyKey)
    ]);

    // Prefer new path; fallback to legacy if only legacy exists
    const chosenBasePath = metadataExists ? basePath : (legacyMetadataExists ? legacyBasePath : basePath);
    const indexKey = `${chosenBasePath}/index.json`;
    const indexExists = await storageClient.fileExists(indexKey);

    if (!indexExists && !metadataExists && !legacyMetadataExists) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: 'The specified borelog does not exist in S3 storage'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Read the current index.json if present; otherwise initialize a fresh index for first version
    let currentIndex: { latest_version: number; approved_version?: number; versions: number[] } = {
      latest_version: 0,
      versions: []
    };

    if (indexExists) {
      try {
        const indexBuffer = await storageClient.downloadFile(indexKey);
        currentIndex = JSON.parse(indexBuffer.toString('utf-8'));
      } catch (error) {
        logger.error('Failed to read index.json', { error, borelogId: borelogData.borelog_id });
        const response = createResponse(500, {
          success: false,
          message: 'Internal server error',
          error: 'Failed to read borelog index'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
    }

    // Compute next version number (use provided version_no or increment latest_version)
    const nextVersion = borelogData.version_no || (currentIndex.latest_version + 1);

    // Safety check: prevent version overwrites
    if (currentIndex.versions.includes(nextVersion)) {
      const response = createResponse(409, {
        success: false,
        message: 'Version already exists',
        error: `Version ${nextVersion} already exists for this borelog`
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Parse stratum data from JSON if provided
    let stratumDescription = borelogData.stratum_description;
    let stratumDepthFrom = borelogData.stratum_depth_from;
    let stratumDepthTo = borelogData.stratum_depth_to;
    let stratumThicknessM = borelogData.stratum_thickness_m;
    let sampleEventType = borelogData.sample_event_type;
    let sampleEventDepthM = borelogData.sample_event_depth_m;
    let runLengthM = borelogData.run_length_m;
    let sptBlowsPer15cm = borelogData.spt_blows_per_15cm;
    let nValueIs2131 = borelogData.n_value_is_2131;
    let totalCoreLengthCm = borelogData.total_core_length_cm;
    let tcrPercent = borelogData.tcr_percent;
    let rqdLengthCm = borelogData.rqd_length_cm;
    let rqdPercent = borelogData.rqd_percent;
    let returnWaterColour = borelogData.return_water_colour;
    let waterLoss = borelogData.water_loss;
    let boreholeDiameter = borelogData.borehole_diameter;

    // If stratum_data JSON is provided, parse it and extract values from the first stratum
    if (borelogData.stratum_data) {
      try {
        const stratumData = JSON.parse(borelogData.stratum_data);
        if (Array.isArray(stratumData) && stratumData.length > 0) {
          const firstStratum = stratumData[0];
          
          // Map JSON fields to individual columns
          stratumDescription = firstStratum.description || stratumDescription;
          stratumDepthFrom = firstStratum.depth_from || stratumDepthFrom;
          stratumDepthTo = firstStratum.depth_to || stratumDepthTo;
          stratumThicknessM = firstStratum.thickness || stratumThicknessM;
          sampleEventType = firstStratum.sample_type || sampleEventType;
          sampleEventDepthM = firstStratum.sample_depth ? parseFloat(firstStratum.sample_depth) : sampleEventDepthM;
          runLengthM = firstStratum.run_length || runLengthM;
          sptBlowsPer15cm = firstStratum.spt_15cm_1 || sptBlowsPer15cm; // Use first SPT value
          nValueIs2131 = firstStratum.n_value ? firstStratum.n_value.toString() : nValueIs2131;
          totalCoreLengthCm = firstStratum.total_core_length || totalCoreLengthCm;
          tcrPercent = firstStratum.tcr_percent || tcrPercent;
          rqdLengthCm = firstStratum.rqd_length || rqdLengthCm;
          rqdPercent = firstStratum.rqd_percent || rqdPercent;
          returnWaterColour = firstStratum.return_water_color || returnWaterColour;
          waterLoss = firstStratum.water_loss || waterLoss;
          boreholeDiameter = firstStratum.borehole_diameter ? parseFloat(firstStratum.borehole_diameter) : boreholeDiameter;
        }
      } catch (error) {
        logger.warn('Failed to parse stratum_data JSON:', error);
      }
    }

    // Create timestamp for the new version
    const createdAt = new Date().toISOString();

    // Create version metadata.json
    const versionMetadata = {
      version: nextVersion,
      status: 'DRAFT', // As per requirements, default status is DRAFT
      created_by: payload.userId,
      created_at: createdAt,
      source_version: currentIndex.latest_version || null
    };

    // Create metadata.json key and upload
    const metadataKey = `${chosenBasePath}/versions/v${nextVersion}/metadata.json`;
    const metadataUpload = storageClient.uploadFile(
      metadataKey,
      Buffer.from(JSON.stringify(versionMetadata, null, 2), 'utf-8'),
      'application/json'
    );

    // TODO: Create Parquet data file with borelog tabular data
    // For now, create a placeholder - this will be implemented in the next step
    const dataKey = `${chosenBasePath}/versions/v${nextVersion}/data.parquet`;

    // Placeholder Parquet data - in real implementation this would contain stratum data
    const parquetPlaceholder = {
      borelog_id: borelogData.borelog_id,
      version: nextVersion,
      stratum_data: {
        stratum_description: stratumDescription,
        stratum_depth_from: stratumDepthFrom,
        stratum_depth_to: stratumDepthTo,
        stratum_thickness_m: stratumThicknessM,
        sample_event_type: sampleEventType,
        sample_event_depth_m: sampleEventDepthM,
        run_length_m: runLengthM,
        spt_blows_per_15cm: sptBlowsPer15cm,
        n_value_is_2131: nValueIs2131,
        total_core_length_cm: totalCoreLengthCm,
        tcr_percent: tcrPercent,
        rqd_length_cm: rqdLengthCm,
        rqd_percent: rqdPercent,
        return_water_colour: returnWaterColour,
        water_loss: waterLoss,
        borehole_diameter: boreholeDiameter
      },
      _placeholder: true // Remove this when real Parquet implementation is added
    };

    const dataUpload = storageClient.uploadFile(
      dataKey,
      Buffer.from(JSON.stringify(parquetPlaceholder), 'utf-8'),
      'application/parquet'
    );

    // Update index.json with new version
    const updatedIndex = {
      latest_version: nextVersion,
      approved_version: currentIndex.approved_version,
      versions: [...currentIndex.versions, nextVersion].sort((a, b) => a - b)
    };

    const indexUpload = storageClient.uploadFile(
      indexKey,
      Buffer.from(JSON.stringify(updatedIndex, null, 2), 'utf-8'),
      'application/json'
    );

    // Perform uploads in parallel to minimize latency/timeouts
    await Promise.all([metadataUpload, dataUpload, indexUpload]);

    // Create response object matching the original DB-based response structure
    const newVersion = {
      borelog_id: borelogData.borelog_id,
      version_no: nextVersion,
      number: borelogData.number,
      msl: borelogData.msl,
      boring_method: borelogData.boring_method,
      hole_diameter: borelogData.hole_diameter,
      commencement_date: borelogData.commencement_date,
      completion_date: borelogData.completion_date,
      standing_water_level: borelogData.standing_water_level,
      termination_depth: borelogData.termination_depth,
      coordinate: borelogData.coordinate,
      permeability_test_count: borelogData.permeability_test_count,
      spt_vs_test_count: borelogData.spt_vs_test_count,
      undisturbed_sample_count: borelogData.undisturbed_sample_count,
      disturbed_sample_count: borelogData.disturbed_sample_count,
      water_sample_count: borelogData.water_sample_count,
      stratum_description: stratumDescription,
      stratum_depth_from: stratumDepthFrom,
      stratum_depth_to: stratumDepthTo,
      stratum_thickness_m: stratumThicknessM,
      sample_event_type: sampleEventType,
      sample_event_depth_m: sampleEventDepthM,
      run_length_m: runLengthM,
      spt_blows_per_15cm: sptBlowsPer15cm,
      n_value_is_2131: nValueIs2131,
      total_core_length_cm: totalCoreLengthCm,
      tcr_percent: tcrPercent,
      rqd_length_cm: rqdLengthCm,
      rqd_percent: rqdPercent,
      return_water_colour: returnWaterColour,
      water_loss: waterLoss,
      borehole_diameter: boreholeDiameter,
      job_code: borelogData.job_code,
      location: borelogData.location,
      chainage_km: borelogData.chainage_km,
      remarks: borelogData.remarks,
      created_by_user_id: payload.userId,
      status: 'DRAFT'
    };

    // Note: Stratum data is now stored directly in the Parquet file
    // No additional relational storage needed for S3-based approach

    const response = createResponse(201, {
      success: true,
      message: 'Borelog version created successfully',
      data: newVersion
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error creating borelog version:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create borelog version'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

