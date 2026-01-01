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

    // Get borelogs from S3 (optimized - load all related data once)
      const storageClient = createStorageClient();
    const projectPrefix = `projects/project_${projectId}/`;
    const borelogsPrefix = `${projectPrefix}borelogs/`;
    
    // Load all related data in parallel for optimization
    const [metadataKeys, projectInfo, structuresMap, substructuresMap] = await Promise.all([
      // 1. Get all borelog metadata files
      (async () => {
      const storageMode = (process.env.STORAGE_MODE || '').toLowerCase();
      const isOffline = storageMode !== 's3' && process.env.IS_OFFLINE === 'true';

      if (isOffline) {
        const localStoragePath = process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), 'local-storage');
        const borelogsDir = path.join(localStoragePath, borelogsPrefix);
          const keys: string[] = [];
        
        try {
          const entries = await fs.readdir(borelogsDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && entry.name.startsWith('borelog_')) {
              const metadataPath = path.join(borelogsDir, entry.name, 'metadata.json');
              try {
                await fs.access(metadataPath);
                  keys.push(`${borelogsPrefix}${entry.name}/metadata.json`);
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
          return keys;
      } else {
          try {
            const allKeys = await storageClient.listFiles(borelogsPrefix, 10000);
            const keys = allKeys.filter(key => key.endsWith('/metadata.json'));
            logger.info(`[S3] Found ${keys.length} metadata files for project ${projectId}`);
            return keys;
          } catch (error) {
            logger.error('Error listing S3 files:', error);
            return [];
          }
        }
      })(),
      
      // 2. Load project info once
      (async () => {
        try {
          const projectBuffer = await storageClient.downloadFile(`${projectPrefix}project.json`);
          return JSON.parse(projectBuffer.toString('utf-8'));
        } catch (error) {
          logger.warn(`Could not load project info for project ${projectId}`);
          return null;
        }
      })(),
      
      // 3. Load all structures once and create lookup map
      (async () => {
        const structuresPrefix = `${projectPrefix}structures/`;
        const map = new Map<string, any>();
        
        try {
          const storageMode = (process.env.STORAGE_MODE || '').toLowerCase();
          const isOffline = storageMode !== 's3' && process.env.IS_OFFLINE === 'true';
          let structureKeys: string[] = [];
          
          if (isOffline) {
            const localStoragePath = process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), 'local-storage');
            const structuresDir = path.join(localStoragePath, structuresPrefix);
        try {
              const entries = await fs.readdir(structuresDir, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.isDirectory() && entry.name.startsWith('structure_')) {
                  const structureJsonPath = path.join(structuresDir, entry.name, 'structure.json');
                  try {
                    await fs.access(structureJsonPath);
                    structureKeys.push(`${structuresPrefix}${entry.name}/structure.json`);
                  } catch {
                    continue;
                  }
                }
              }
            } catch (error: any) {
              if (error.code !== 'ENOENT') {
                logger.error('Error listing local structure directories:', error);
              }
            }
          } else {
            const allKeys = await storageClient.listFiles(structuresPrefix, 10000);
            structureKeys = allKeys.filter(key => key.endsWith('/structure.json') && !key.includes('/substructures/'));
          }
          
          const structureBuffers = await Promise.all(
            structureKeys.map(key => 
              storageClient.downloadFile(key)
                .then(buffer => ({ key, buffer }))
                .catch(() => null)
            )
          );
          
          structureBuffers
            .filter((item): item is { key: string; buffer: Buffer } => item !== null)
            .forEach(item => {
              try {
                const structure = JSON.parse(item.buffer.toString('utf-8'));
                map.set(structure.structure_id, structure);
              } catch (error) {
                logger.error(`Error parsing structure from ${item.key}:`, error);
              }
            });
        } catch (error) {
          logger.warn('Error loading structures:', error);
        }
        
        return map;
      })(),
      
      // 4. Load all substructures once and create lookup map
      (async () => {
        const structuresPrefix = `${projectPrefix}structures/`;
        const map = new Map<string, any>();
        
        try {
          const storageMode = (process.env.STORAGE_MODE || '').toLowerCase();
          const isOffline = storageMode !== 's3' && process.env.IS_OFFLINE === 'true';
          let substructureKeys: string[] = [];
          
          if (isOffline) {
            const localStoragePath = process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), 'local-storage');
            const structuresDir = path.join(localStoragePath, structuresPrefix);
            
            // Recursive function to find substructure.json files
            const findSubstructureFiles = async (dir: string, basePath: string): Promise<string[]> => {
              const keys: string[] = [];
              try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                  const fullPath = path.join(dir, entry.name);
                  if (entry.isDirectory() && entry.name.startsWith('structure_')) {
                    // Check for substructures directory
                    const substructuresDir = path.join(fullPath, 'substructures');
                    try {
                      const substructureEntries = await fs.readdir(substructuresDir, { withFileTypes: true });
                      for (const subEntry of substructureEntries) {
                        if (subEntry.isDirectory() && subEntry.name.startsWith('substructure_')) {
                          const substructureJsonPath = path.join(substructuresDir, subEntry.name, 'substructure.json');
                          try {
                            await fs.access(substructureJsonPath);
                            const relativePath = path.relative(basePath, substructureJsonPath);
                            keys.push(`projects/${relativePath.replace(/\\/g, '/')}`);
                          } catch {
                            continue;
                          }
                        }
                      }
                    } catch {
                      // No substructures directory, continue
                    }
                  }
                }
              } catch (error: any) {
                if (error.code !== 'ENOENT') {
                  logger.error('Error listing local substructure files:', error);
                }
              }
              return keys;
            };
            
            substructureKeys = await findSubstructureFiles(structuresDir, path.join(localStoragePath, 'projects'));
          } else {
            const allKeys = await storageClient.listFiles(structuresPrefix, 10000);
            substructureKeys = allKeys.filter(key => key.endsWith('/substructure.json'));
          }
          
          const substructureBuffers = await Promise.all(
            substructureKeys.map(key => 
              storageClient.downloadFile(key)
                .then(buffer => ({ key, buffer }))
                .catch(() => null)
            )
          );
          
          substructureBuffers
            .filter((item): item is { key: string; buffer: Buffer } => item !== null)
            .forEach(item => {
              try {
                const substructure = JSON.parse(item.buffer.toString('utf-8'));
                map.set(substructure.substructure_id, substructure);
              } catch (error) {
                logger.error(`Error parsing substructure from ${item.key}:`, error);
              }
            });
        } catch (error) {
          logger.warn('Error loading substructures:', error);
        }
        
        return map;
      })()
    ]);

    // Process all borelog metadata files in parallel
      const borelogPromises = metadataKeys.map(async (key) => {
      try {
        const metadataBuffer = await storageClient.downloadFile(key);
        const metadata = JSON.parse(metadataBuffer.toString('utf-8'));
        
        // Get latest version
        const latestVersion = metadata.versions && metadata.versions.length > 0 
          ? metadata.versions[metadata.versions.length - 1]
          : null;
        
        // Get substructure and structure info from pre-loaded maps
        const substructureInfo = substructuresMap.get(metadata.substructure_id) || null;
        const structureInfo = substructureInfo 
          ? structuresMap.get(substructureInfo.structure_id) || null
          : null;
        
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
      const aDate = new Date(a.borelog_created_at || 0).getTime();
      const bDate = new Date(b.borelog_created_at || 0).getTime();
      return bDate - aDate;
    });

    logger.info(`[S3] Successfully loaded ${borelogs.length} borelogs from S3 for project ${projectId}`);
    
    if (borelogs.length === 0) {
      logger.warn(`[S3] No borelogs found for project ${projectId}`);
    } else {
      logger.info(`[S3] Sample borelog IDs: ${borelogs.slice(0, 3).map(b => b.borelog_id).join(', ')}`);
    }

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
