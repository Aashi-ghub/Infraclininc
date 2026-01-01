import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { validate as validateUUID } from 'uuid';
import { checkBorelogAssignment } from '../utils/projectAccess';
import { createStorageClient } from '../storage/s3Client';

/**
 * MIGRATED: This handler now reads from S3 instead of database
 * S3 Structure:
 * - Borelog metadata: projects/project_{project_id}/borelogs/borelog_{borelog_id}/metadata.json
 * - Parsed strata: projects/project_{project_id}/borelogs/borelog_{borelog_id}/parsed/v{version}/strata.json
 * - Project info: projects/project_{project_id}/project.json
 * - Structure info: projects/project_{project_id}/structures/structure_{structure_id}/structure.json
 * - Substructure info: projects/project_{project_id}/structures/structure_{structure_id}/substructures/substructure_{substructure_id}/substructure.json
 */

interface ParsedStrataData {
  borehole: {
    project_id: string;
    structure_id?: string;
    substructure_id?: string;
    borelog_id: string;
    version_no: number;
    upload_id: string;
    file_type: string;
    requested_by?: string;
    job_code?: string;
    metadata: Record<string, any>;
    parsed_at: string;
  };
  strata: Array<{
    description: string;
    depth_from: number;
    depth_to: number;
    thickness_m: number;
    n_value?: number;
    tcr_percent?: number;
    rqd_percent?: number;
    return_water_colour?: string;
    water_loss?: string;
    borehole_diameter?: string;
    remarks?: string;
    samples: Array<Record<string, any>>;
  }>;
}

/**
 * Find borelog metadata in S3 to get project_id
 */
async function findBorelogMetadata(
  storageClient: ReturnType<typeof createStorageClient>,
  borelogId: string
): Promise<{ projectId: string; metadata: any; basePath: string } | null> {
  try {
    const keys = await storageClient.listFiles('projects/', 20000);
    // Look for metadata.json files in borelog directories: projects/project_{projectId}/borelogs/borelog_{borelogId}/metadata.json
    const metadataKeys = keys.filter(
      (k) => k.endsWith('/metadata.json') && k.includes('/borelogs/borelog_') && !k.includes('/versions/') && !k.includes('/parsed/')
    );

    for (const key of metadataKeys) {
      try {
        const buf = await storageClient.downloadFile(key);
        const meta = JSON.parse(buf.toString('utf-8'));
        if (meta?.borelog_id === borelogId && meta?.project_id) {
          const basePath = key.replace(/\/metadata\.json$/, '');
          return { projectId: meta.project_id, metadata: meta, basePath };
        }
      } catch {
        continue;
      }
    }

    logger.warn('Could not find borelog metadata in S3', { borelogId });
    return null;
  } catch (error) {
    logger.error('Error finding borelog metadata', { error, borelogId });
    return null;
  }
}

/**
 * List all parsed versions for a borelog
 * Uses standardized path: projects/project_{project_id}/borelogs/borelog_{borelog_id}/parsed/
 */
async function listParsedVersions(
  storageClient: ReturnType<typeof createStorageClient>,
  projectId: string,
  borelogId: string
): Promise<number[]> {
  try {
    const prefix = `projects/project_${projectId}/borelogs/borelog_${borelogId}/parsed/`;
    const keys = await storageClient.listFiles(prefix, 1000);
    
    // Extract version numbers from paths like: projects/project_{projectId}/borelogs/borelog_{borelogId}/parsed/v{version}/strata.json
    const versions = new Set<number>();
    const versionRegex = /\/parsed\/v(\d+)\//;
    
    for (const key of keys) {
      const match = key.match(versionRegex);
      if (match && key.endsWith('/strata.json')) {
        versions.add(parseInt(match[1], 10));
      }
    }
    
    return Array.from(versions).sort((a, b) => b - a); // Descending order (latest first)
  } catch (error) {
    logger.error('Error listing parsed versions', { error, projectId, borelogId });
    return [];
  }
}

/**
 * Read parsed strata data for a specific version
 * Uses standardized path: projects/project_{project_id}/borelogs/borelog_{borelog_id}/parsed/v{version}/strata.json
 * This is the source of truth - DO NOT rebuild from metadata or legacy DB fields.
 */
async function readParsedStrata(
  storageClient: ReturnType<typeof createStorageClient>,
  projectId: string,
  borelogId: string,
  versionNo: number
): Promise<ParsedStrataData | null> {
  const key = `projects/project_${projectId}/borelogs/borelog_${borelogId}/parsed/v${versionNo}/strata.json`;
  try {
    const buf = await storageClient.downloadFile(key);
    const parsedData = JSON.parse(buf.toString('utf-8')) as ParsedStrataData;
    
    // Calculate sample counts for logging
    const strataCount = parsedData.strata?.length || 0;
    const totalSamples = parsedData.strata?.reduce((sum, s) => sum + (s.samples?.length || 0), 0) || 0;
    
    logger.info('Loaded parsed strata from S3', { 
      projectId, 
      borelogId, 
      versionNo,
      s3Key: key,
      strataCount,
      totalSamples
    });
    
    return parsedData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('Could not read parsed strata from S3', { 
      key, 
      error: errorMessage,
      projectId, 
      borelogId, 
      versionNo 
    });
    return null;
  }
}

/**
 * Read project metadata
 */
async function readProjectMetadata(
  storageClient: ReturnType<typeof createStorageClient>,
  projectId: string
): Promise<any | null> {
  try {
    const key = `projects/project_${projectId}/project.json`;
    const buf = await storageClient.downloadFile(key);
    return JSON.parse(buf.toString('utf-8'));
  } catch (error) {
    logger.warn('Could not read project metadata', { error, projectId });
    return null;
  }
}

/**
 * Read structure and substructure metadata
 */
async function readStructureMetadata(
  storageClient: ReturnType<typeof createStorageClient>,
  projectId: string,
  structureId?: string,
  substructureId?: string
): Promise<{ structure: any | null; substructure: any | null }> {
  let structure: any | null = null;
  let substructure: any | null = null;

  if (structureId) {
    try {
      const structureKey = `projects/project_${projectId}/structures/structure_${structureId}/structure.json`;
      const structureBuf = await storageClient.downloadFile(structureKey);
      structure = JSON.parse(structureBuf.toString('utf-8'));
    } catch (error) {
      logger.warn('Could not read structure metadata', { error, projectId, structureId });
    }
  }

  if (substructureId && structureId) {
    try {
      const substructureKey = `projects/project_${projectId}/structures/structure_${structureId}/substructures/substructure_${substructureId}/substructure.json`;
      const substructureBuf = await storageClient.downloadFile(substructureKey);
      substructure = JSON.parse(substructureBuf.toString('utf-8'));
    } catch (error) {
      logger.warn('Could not read substructure metadata', { error, projectId, structureId, substructureId });
    }
  }

  return { structure, substructure };
}

/**
 * Transform parsed strata data to structured format for API response
 * Uses parsed strata JSON directly - DO NOT rebuild from metadata or legacy DB fields.
 * Returns strata array where each stratum includes all its samples in a nested array.
 */
function transformStrataToVersionDetails(
  parsedData: ParsedStrataData,
  projectId: string,
  substructureId?: string
): { version_no: number; created_at: string; created_by_user_id: string | null; metadata: any; strata: any[] } {
  const { borehole, strata } = parsedData;

  // Extract metadata from borehole
  const metadata = borehole.metadata || {};
  
  // Transform strata to match API response format
  // Use parsed strata directly - each stratum already contains its samples array
  const transformedStrata = (strata || []).map((stratum: any) => {
    // Handle both new format (thickness_m) and legacy format (thickness)
    const thickness_m = stratum.thickness_m !== null && stratum.thickness_m !== undefined
      ? stratum.thickness_m
      : (stratum.thickness !== null && stratum.thickness !== undefined
          ? stratum.thickness
          : (stratum.depth_from !== null && stratum.depth_to !== null 
              ? stratum.depth_to - stratum.depth_from 
              : null));
    
    // Handle both new format (return_water_colour) and legacy format (colour_of_return_water)
    const return_water_colour = stratum.return_water_colour || stratum.colour_of_return_water || undefined;
    
    // Handle both new format (borehole_diameter) and legacy format (diameter_of_borehole)
    const borehole_diameter = stratum.borehole_diameter || stratum.diameter_of_borehole || undefined;
    
    // Transform samples array - ensure all required fields are present
    // The parsed strata JSON already has samples with sample_code, sample_event_type, etc.
    const transformedSamples = (stratum.samples || []).map((sample: any) => {
      // Handle penetration_15cm which can be an array or individual values
      let spt_blows = null;
      if (sample.penetration_15cm) {
        if (Array.isArray(sample.penetration_15cm)) {
          // If it's an array, use it directly or convert to a single value if needed
          spt_blows = sample.penetration_15cm;
        } else {
          spt_blows = sample.penetration_15cm;
        }
      }
      
      return {
        sample_code: sample.sample_code || null,
        sample_type: sample.sample_event_type || sample.type || null,
        depth_m: sample.sample_event_depth_m || sample.depth_m || null,
        run_length_m: sample.run_length_m !== null && sample.run_length_m !== undefined ? sample.run_length_m : null,
        n_value: sample.n_value !== null && sample.n_value !== undefined ? sample.n_value : null,
        remarks: sample.remarks || null,
        // Additional test data fields
        spt_blows: spt_blows,
        total_core_length_cm: sample.total_core_length_cm !== null && sample.total_core_length_cm !== undefined ? sample.total_core_length_cm : null,
        tcr_percent: sample.tcr_percent !== null && sample.tcr_percent !== undefined ? sample.tcr_percent : null,
        rqd_length_cm: sample.rqd_length_cm !== null && sample.rqd_length_cm !== undefined ? sample.rqd_length_cm : null,
        rqd_percent: sample.rqd_percent !== null && sample.rqd_percent !== undefined ? sample.rqd_percent : null,
      };
    });
    
    return {
      description: stratum.description || '',
      depth_from: stratum.depth_from,
      depth_to: stratum.depth_to,
      thickness_m: thickness_m,
      n_value: stratum.n_value !== null && stratum.n_value !== undefined ? stratum.n_value : undefined,
      tcr_percent: stratum.tcr_percent !== null && stratum.tcr_percent !== undefined ? stratum.tcr_percent : undefined,
      rqd_percent: stratum.rqd_percent !== null && stratum.rqd_percent !== undefined ? stratum.rqd_percent : undefined,
      return_water_colour: return_water_colour,
      water_loss: stratum.water_loss || undefined,
      borehole_diameter: borehole_diameter,
      remarks: stratum.remarks || undefined,
      // Include samples array - this is the key fix: samples should come from parsed strata
      samples: transformedSamples,
    };
  });

  return {
    version_no: borehole.version_no,
    created_at: borehole.parsed_at,
    created_by_user_id: borehole.requested_by || null,
    metadata: {
      number: metadata.borehole_no || metadata.number || null,
      boring_method: metadata.method_of_boring || metadata.boring_method || null,
      hole_diameter: metadata.diameter_of_hole || metadata.hole_diameter || null,
      commencement_date: metadata.commencement_date || null,
      completion_date: metadata.completion_date || null,
      standing_water_level: metadata.standing_water_level || null,
      termination_depth: metadata.termination_depth || null,
      permeability_test_count: metadata.permeability_tests_count || 0,
      spt_vs_test_count: metadata.spt_tests_count || 0,
      undisturbed_sample_count: metadata.undisturbed_samples_count || 0,
      disturbed_sample_count: metadata.disturbed_samples_count || 0,
      water_sample_count: metadata.water_samples_count || 0,
      job_code: borehole.job_code || metadata.job_code || null,
      location: metadata.location || null,
      chainage_km: metadata.chainage_km !== null && metadata.chainage_km !== undefined ? metadata.chainage_km : null,
      msl: metadata.msl !== null && metadata.msl !== undefined ? metadata.msl : null,
      coordinate: metadata.coordinate ? {
        type: 'Point',
        coordinates: Array.isArray(metadata.coordinate) 
          ? metadata.coordinate 
          : [metadata.coordinate_e || 0, metadata.coordinate_l || 0]
      } : (metadata.coordinate_e || metadata.coordinate_l ? {
        type: 'Point',
        coordinates: [metadata.coordinate_e || 0, metadata.coordinate_l || 0]
      } : null),
      substructure_id: substructureId || borehole.substructure_id || null,
      project_id: projectId,
    },
    strata: transformedStrata,
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // MIGRATED: Removed DB guard - now S3-only
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer'])(event);
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

    if (!validateUUID(borelogId)) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid borelog_id format',
        error: 'borelog_id must be a valid UUID'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // For Site Engineers, check if they are assigned to this borelog
    // Note: This still uses DB for assignment check - consider migrating to S3 if needed
    if (payload.role === 'Site Engineer') {
      const isAssigned = await checkBorelogAssignment(payload.userId, borelogId);
      
      if (!isAssigned) {
        const response = createResponse(403, {
          success: false,
          message: 'Access denied: Borelog not assigned to you',
          error: 'You can only access borelog details for borelogs that are assigned to you'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
    }

    // Initialize S3 storage client
    const storageClient = createStorageClient();

    // Find borelog metadata to get project_id
    const borelogMeta = await findBorelogMetadata(storageClient, borelogId);
    if (!borelogMeta) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: 'No borelog found for the specified borelog_id'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const { projectId, metadata: borelogMetadata } = borelogMeta;
    const structureId = borelogMetadata.structure_id;
    const substructureId = borelogMetadata.substructure_id || borelogMetadata.substructure_id;

    // Load project, structure, and substructure metadata in parallel
    const [projectInfo, structureInfo] = await Promise.all([
      readProjectMetadata(storageClient, projectId),
      readStructureMetadata(storageClient, projectId, structureId, substructureId),
    ]);

    // List all parsed versions
    const versions = await listParsedVersions(storageClient, projectId, borelogId);
    
    if (versions.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog details not found',
        error: 'No parsed versions found for this borelog'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Read parsed strata for all versions
    const parsedDataPromises = versions.map(versionNo => 
      readParsedStrata(storageClient, projectId, borelogId, versionNo)
    );
    const parsedDataArray = await Promise.all(parsedDataPromises);
    
    // Transform to version details with structured strata
    const versionDetails = parsedDataArray
      .filter((parsedData): parsedData is ParsedStrataData => parsedData !== null)
      .map(parsedData => transformStrataToVersionDetails(parsedData, projectId, substructureId));

    if (versionDetails.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog details not found',
        error: 'No borelog details found for the specified borelog_id'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Build version history (latest first) - sorted by version number descending
    const versionHistory = versionDetails
      .sort((a, b) => b.version_no - a.version_no)
      .map((versionDetail) => {
        return {
          version_no: versionDetail.version_no,
          created_at: versionDetail.created_at,
          created_by: {
            user_id: versionDetail.created_by_user_id,
            name: null, // User info not stored in parsed data
            email: null
          },
          details: {
            ...versionDetail.metadata,
            // Return structured strata array - one row in Excel = one object in strata[]
            strata: versionDetail.strata
          }
        };
      });

    const response = createResponse(200, {
      success: true,
      message: 'Borelog details retrieved successfully',
      data: {
        borelog_id: borelogId,
        borelog_type: borelogMetadata.type || 'Geotechnical',
        project: {
          project_id: projectId,
          name: projectInfo?.name || null,
          location: projectInfo?.location || null
        },
        structure: {
          structure_type: structureInfo.structure?.type || null,
          description: structureInfo.structure?.description || null,
          substructure_id: substructureId || null,
          substructure_type: structureInfo.substructure?.type || null,
          substructure_remark: structureInfo.substructure?.remark || null
        },
        version_history: versionHistory,
        latest_version: versionHistory[0] // First item is the latest due to DESC ordering
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error retrieving borelog details:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve borelog details'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};
