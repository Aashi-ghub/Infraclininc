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
    depth_from: number;
    depth_to: number;
    description: string;
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
 */
async function readParsedStrata(
  storageClient: ReturnType<typeof createStorageClient>,
  projectId: string,
  borelogId: string,
  versionNo: number
): Promise<ParsedStrataData | null> {
  try {
    const key = `projects/project_${projectId}/borelogs/borelog_${borelogId}/parsed/v${versionNo}/strata.json`;
    const buf = await storageClient.downloadFile(key);
    return JSON.parse(buf.toString('utf-8')) as ParsedStrataData;
  } catch (error) {
    logger.warn('Could not read parsed strata', { error, projectId, borelogId, versionNo });
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
 * Transform parsed strata data to match the expected response format
 * The old DB format had flat rows with stratum and sample data combined
 */
function transformStrataToVersionDetails(
  parsedData: ParsedStrataData,
  projectId: string,
  substructureId?: string
): any[] {
  const details: any[] = [];
  const { borehole, strata } = parsedData;

  // Extract metadata from borehole
  const metadata = borehole.metadata || {};
  
  for (const stratum of strata) {
    // If stratum has samples, create a detail row for each sample
    if (stratum.samples && stratum.samples.length > 0) {
      for (const sample of stratum.samples) {
        details.push({
          version_no: borehole.version_no,
          created_at: borehole.parsed_at,
          created_by_user_id: borehole.requested_by || null,
          number: metadata.borehole_no || metadata.number || null,
          msl: metadata.msl || null,
          boring_method: metadata.method_of_boring || metadata.boring_method || null,
          hole_diameter: metadata.diameter_of_hole || metadata.hole_diameter || null,
          commencement_date: metadata.commencement_date || null,
          completion_date: metadata.completion_date || null,
          standing_water_level: metadata.standing_water_level || null,
          termination_depth: metadata.termination_depth || null,
          coordinate: metadata.coordinate ? {
            type: 'Point',
            coordinates: Array.isArray(metadata.coordinate) 
              ? metadata.coordinate 
              : [metadata.coordinate_e || 0, metadata.coordinate_l || 0]
          } : null,
          permeability_test_count: metadata.permeability_tests_count || 0,
          spt_vs_test_count: metadata.spt_tests_count || 0,
          undisturbed_sample_count: metadata.undisturbed_samples_count || 0,
          disturbed_sample_count: metadata.disturbed_samples_count || 0,
          water_sample_count: metadata.water_samples_count || 0,
          job_code: borehole.job_code || metadata.job_code || null,
          location: metadata.location || null,
          chainage_km: metadata.chainage_km || null,
          stratum_description: stratum.description,
          stratum_depth_from: stratum.depth_from,
          stratum_depth_to: stratum.depth_to,
          stratum_thickness_m: stratum.depth_to - stratum.depth_from,
          sample_event_type: sample.sample_event_type || sample.type || null,
          sample_event_depth_m: sample.depth || sample.depth_m || sample.sample_event_depth_m || null,
          run_length_m: sample.run_length_m || null,
          spt_blows_per_15cm: sample.spt_blows_per_15cm || null,
          n_value_is_2131: sample.n_value_is_2131 || sample.n_value || null,
          total_core_length_cm: sample.total_core_length_cm || null,
          tcr_percent: sample.tcr_percent || null,
          rqd_length_cm: sample.rqd_length_cm || null,
          rqd_percent: sample.rqd_percent || null,
          return_water_colour: sample.return_water_colour || null,
          water_loss: sample.water_loss || null,
          borehole_diameter: sample.borehole_diameter || null,
          remarks: sample.remarks || null,
          images: null, // Images stored separately
          substructure_id: substructureId || borehole.substructure_id || null,
          project_id: projectId,
        });
      }
    } else {
      // If no samples, create a single detail row for the stratum
      details.push({
        version_no: borehole.version_no,
        created_at: borehole.parsed_at,
        created_by_user_id: borehole.requested_by || null,
        number: metadata.borehole_no || metadata.number || null,
        msl: metadata.msl || null,
        boring_method: metadata.method_of_boring || metadata.boring_method || null,
        hole_diameter: metadata.diameter_of_hole || metadata.hole_diameter || null,
        commencement_date: metadata.commencement_date || null,
        completion_date: metadata.completion_date || null,
        standing_water_level: metadata.standing_water_level || null,
        termination_depth: metadata.termination_depth || null,
        coordinate: metadata.coordinate ? {
          type: 'Point',
          coordinates: Array.isArray(metadata.coordinate) 
            ? metadata.coordinate 
            : [metadata.coordinate_e || 0, metadata.coordinate_l || 0]
        } : null,
        permeability_test_count: metadata.permeability_tests_count || 0,
        spt_vs_test_count: metadata.spt_tests_count || 0,
        undisturbed_sample_count: metadata.undisturbed_samples_count || 0,
        disturbed_sample_count: metadata.disturbed_samples_count || 0,
        water_sample_count: metadata.water_samples_count || 0,
        job_code: borehole.job_code || metadata.job_code || null,
        location: metadata.location || null,
        chainage_km: metadata.chainage_km || null,
        stratum_description: stratum.description,
        stratum_depth_from: stratum.depth_from,
        stratum_depth_to: stratum.depth_to,
        stratum_thickness_m: stratum.depth_to - stratum.depth_from,
        sample_event_type: null,
        sample_event_depth_m: null,
        run_length_m: null,
        spt_blows_per_15cm: null,
        n_value_is_2131: null,
        total_core_length_cm: null,
        tcr_percent: null,
        rqd_length_cm: null,
        rqd_percent: null,
        return_water_colour: null,
        water_loss: null,
        borehole_diameter: null,
        remarks: null,
        images: null,
        substructure_id: substructureId || borehole.substructure_id || null,
        project_id: projectId,
      });
    }
  }

  return details;
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
    
    // Filter out null results and transform to version details
    const allVersionDetails: any[] = [];
    for (let i = 0; i < parsedDataArray.length; i++) {
      const parsedData = parsedDataArray[i];
      if (parsedData) {
        const details = transformStrataToVersionDetails(parsedData, projectId, substructureId);
        allVersionDetails.push(...details);
      }
    }

    if (allVersionDetails.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog details not found',
        error: 'No borelog details found for the specified borelog_id'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Group by version for better organization (similar to old DB query result)
    const versionMap = new Map<number, any[]>();
    for (const detail of allVersionDetails) {
      if (!versionMap.has(detail.version_no)) {
        versionMap.set(detail.version_no, []);
      }
      versionMap.get(detail.version_no)!.push(detail);
    }

    // Build version history (latest first)
    const versionHistory = Array.from(versionMap.entries())
      .sort(([a], [b]) => b - a) // Sort by version number descending
      .map(([versionNo, details]) => {
        // Use first detail as base (they all have same metadata for a version)
        const baseDetail = details[0];
        return {
          version_no: versionNo,
          created_at: baseDetail.created_at,
          created_by: {
            user_id: baseDetail.created_by_user_id,
            name: null, // User info not stored in parsed data
            email: null
          },
          details: {
            number: baseDetail.number,
            msl: baseDetail.msl,
            boring_method: baseDetail.boring_method,
            hole_diameter: baseDetail.hole_diameter,
            commencement_date: baseDetail.commencement_date,
            completion_date: baseDetail.completion_date,
            standing_water_level: baseDetail.standing_water_level,
            termination_depth: baseDetail.termination_depth,
            coordinate: baseDetail.coordinate,
            permeability_test_count: baseDetail.permeability_test_count,
            spt_vs_test_count: baseDetail.spt_vs_test_count,
            undisturbed_sample_count: baseDetail.undisturbed_sample_count,
            disturbed_sample_count: baseDetail.disturbed_sample_count,
            water_sample_count: baseDetail.water_sample_count,
            stratum_description: details.map(d => d.stratum_description).join('; '), // Combine all stratum descriptions
            stratum_depth_from: Math.min(...details.map(d => d.stratum_depth_from)),
            stratum_depth_to: Math.max(...details.map(d => d.stratum_depth_to)),
            stratum_thickness_m: details.reduce((sum, d) => sum + (d.stratum_thickness_m || 0), 0),
            sample_event_type: details.find(d => d.sample_event_type)?.sample_event_type || null,
            sample_event_depth_m: details.find(d => d.sample_event_depth_m)?.sample_event_depth_m || null,
            run_length_m: details.find(d => d.run_length_m)?.run_length_m || null,
            spt_blows_per_15cm: details.find(d => d.spt_blows_per_15cm)?.spt_blows_per_15cm || null,
            n_value_is_2131: details.find(d => d.n_value_is_2131)?.n_value_is_2131 || null,
            total_core_length_cm: details.find(d => d.total_core_length_cm)?.total_core_length_cm || null,
            tcr_percent: details.find(d => d.tcr_percent)?.tcr_percent || null,
            rqd_length_cm: details.find(d => d.rqd_length_cm)?.rqd_length_cm || null,
            rqd_percent: details.find(d => d.rqd_percent)?.rqd_percent || null,
            return_water_colour: details.find(d => d.return_water_colour)?.return_water_colour || null,
            water_loss: details.find(d => d.water_loss)?.water_loss || null,
            borehole_diameter: details.find(d => d.borehole_diameter)?.borehole_diameter || null,
            remarks: details.find(d => d.remarks)?.remarks || null,
            images: null, // Images stored separately
            substructure_id: baseDetail.substructure_id,
            project_id: baseDetail.project_id
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
