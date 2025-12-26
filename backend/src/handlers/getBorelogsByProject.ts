import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { validate as validateUUID } from 'uuid';
import { createStorageClient } from '../storage/s3Client';
import * as fs from 'fs/promises';
import * as path from 'path';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer'])(event);
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

    const projectId = event.pathParameters?.project_id;
    if (!projectId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing project_id parameter',
        error: 'project_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    if (!validateUUID(projectId)) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid project_id format',
        error: 'project_id must be a valid UUID'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get borelogs from S3
    const storageClient = createStorageClient();
    const borelogsPrefix = `projects/project_${projectId}/borelogs/`;
    
    let metadataKeys: string[] = [];
    
    const storageMode = (process.env.STORAGE_MODE || '').toLowerCase();
    const isOffline = storageMode !== 's3' && process.env.IS_OFFLINE === 'true';

    // Handle local filesystem mode (offline) differently
    if (isOffline) {
      const localStoragePath = process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), 'local-storage');
      const borelogsDir = path.join(localStoragePath, borelogsPrefix);
      
      try {
        const entries = await fs.readdir(borelogsDir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.startsWith('borelog_')) {
            const metadataPath = path.join(borelogsDir, entry.name, 'metadata.json');
            try {
              await fs.access(metadataPath);
              metadataKeys.push(`${borelogsPrefix}${entry.name}/metadata.json`);
            } catch {
              continue;
            }
          }
        }
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          logger.error('Error listing local borelog directories:', error);
        }
      }
    } else {
      // For S3, use listFiles which handles recursive listing
      const allKeys = await storageClient.listFiles(borelogsPrefix, 10000);
      metadataKeys = allKeys.filter(key => key.endsWith('/metadata.json'));
    }

    // Read and parse each metadata.json, then enrich with structure/substructure data
    const borelogPromises = metadataKeys.map(async (key) => {
      try {
        const metadataBuffer = await storageClient.downloadFile(key);
        const metadata = JSON.parse(metadataBuffer.toString('utf-8'));
        
        // Get latest version
        const latestVersion = metadata.versions && metadata.versions.length > 0 
          ? metadata.versions[metadata.versions.length - 1]
          : null;
        
        // Try to get substructure info
        let substructureInfo: any = null;
        let structureInfo: any = null;
        try {
          const substructureKeys = await storageClient.listFiles(
            `projects/project_${projectId}/structures/`, 
            10000
          );
          const substructureKey = substructureKeys.find(k => 
            k.includes(`substructure_${metadata.substructure_id}/substructure.json`)
          );
          
          if (substructureKey) {
            const substructureBuffer = await storageClient.downloadFile(substructureKey);
            substructureInfo = JSON.parse(substructureBuffer.toString('utf-8'));
            
            // Get structure info
            const structureKeys = await storageClient.listFiles(
              `projects/project_${projectId}/structures/`, 
              10000
            );
            const structureKey = structureKeys.find(k => 
              k.includes(`structure_${substructureInfo.structure_id}/structure.json`) &&
              !k.includes('substructures')
            );
            
            if (structureKey) {
              const structureBuffer = await storageClient.downloadFile(structureKey);
              structureInfo = JSON.parse(structureBuffer.toString('utf-8'));
            }
          }
        } catch (error) {
          // If we can't get structure/substructure info, continue without it
          logger.warn(`Could not load structure/substructure info for borelog ${metadata.borelog_id}`);
        }
        
        // Get project info
        let projectInfo: any = null;
        try {
          const projectBuffer = await storageClient.downloadFile(
            `projects/project_${projectId}/project.json`
          );
          projectInfo = JSON.parse(projectBuffer.toString('utf-8'));
        } catch (error) {
          // Continue without project info
        }
        
        return {
          borelog_id: metadata.borelog_id,
          substructure_id: metadata.substructure_id,
          project_id: metadata.project_id,
          borelog_type: metadata.type,
          borelog_created_at: metadata.created_at,
          borelog_created_by: metadata.created_by_user_id,
          substructure_type: substructureInfo?.type || null,
          substructure_remark: substructureInfo?.remark || null,
          structure_id: structureInfo?.structure_id || null,
          structure_type: structureInfo?.type || null,
          structure_description: structureInfo?.description || null,
          project_name: projectInfo?.name || null,
          project_location: projectInfo?.location || null,
          version_no: latestVersion?.version || 1,
          number: latestVersion?.number || null,
          msl: latestVersion?.msl || null,
          boring_method: latestVersion?.boring_method || null,
          hole_diameter: latestVersion?.hole_diameter || null,
          commencement_date: latestVersion?.commencement_date || null,
          completion_date: latestVersion?.completion_date || null,
          standing_water_level: latestVersion?.standing_water_level || null,
          termination_depth: latestVersion?.termination_depth || null,
          coordinate: latestVersion?.coordinate || null,
          permeability_test_count: latestVersion?.permeability_test_count || null,
          spt_vs_test_count: latestVersion?.spt_vs_test_count || null,
          undisturbed_sample_count: latestVersion?.undisturbed_sample_count || null,
          disturbed_sample_count: latestVersion?.disturbed_sample_count || null,
          water_sample_count: latestVersion?.water_sample_count || null,
          stratum_description: latestVersion?.stratum_description || null,
          stratum_depth_from: latestVersion?.stratum_depth_from || null,
          stratum_depth_to: latestVersion?.stratum_depth_to || null,
          stratum_thickness_m: latestVersion?.stratum_thickness_m || null,
          sample_event_type: latestVersion?.sample_event_type || null,
          sample_event_depth_m: latestVersion?.sample_event_depth_m || null,
          run_length_m: latestVersion?.run_length_m || null,
          spt_blows_per_15cm: latestVersion?.spt_blows_per_15cm || null,
          n_value_is_2131: latestVersion?.n_value_is_2131 || null,
          total_core_length_cm: latestVersion?.total_core_length_cm || null,
          tcr_percent: latestVersion?.tcr_percent || null,
          rqd_length_cm: latestVersion?.rqd_length_cm || null,
          rqd_percent: latestVersion?.rqd_percent || null,
          return_water_colour: latestVersion?.return_water_colour || null,
          water_loss: latestVersion?.water_loss || null,
          borehole_diameter: latestVersion?.borehole_diameter || null,
          remarks: latestVersion?.remarks || null,
          images: null,
          details_created_at: latestVersion?.created_at || metadata.created_at,
          details_created_by: latestVersion?.created_by || metadata.created_by_user_id,
          created_by_name: null,
          created_by_email: null,
          assignment_id: null,
          assigned_site_engineer: null,
          assignment_status: null,
          assigned_site_engineer_name: null,
          assigned_site_engineer_email: null
        };
      } catch (error) {
        logger.error(`Error reading borelog metadata from S3 key ${key}:`, error);
        return null;
      }
    });
    
    const borelogResults = await Promise.all(borelogPromises);
    const borelogs = borelogResults
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .sort((a, b) => {
        // Sort by structure_type, substructure_type, then created_at
        const structureCompare = (a.structure_type || '').localeCompare(b.structure_type || '');
        if (structureCompare !== 0) return structureCompare;
        const substructureCompare = (a.substructure_type || '').localeCompare(b.substructure_type || '');
        if (substructureCompare !== 0) return substructureCompare;
        return new Date(b.borelog_created_at).getTime() - new Date(a.borelog_created_at).getTime();
      });

    logger.info(`[S3 READ ENABLED] getBorelogsByProject count=${borelogs.length} project_id=${projectId}`);

    const response = createResponse(200, {
      success: true,
      message: 'Borelogs retrieved successfully',
      data: {
        borelogs: borelogs
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error retrieving borelogs by project:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve borelogs'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 
