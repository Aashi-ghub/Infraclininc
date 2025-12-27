/**
 * getStratumData Handler
 * 
 * =============================================================================
 * ENDPOINT DOCUMENTATION
 * =============================================================================
 * 
 * Route: GET /stratum-data
 * 
 * Request Parameters (Query String):
 *   - borelog_id: UUID (required) - The borelog identifier
 *   - version_no: number (required) - The version number to fetch
 * 
 * Response JSON Structure:
 *   {
 *     success: boolean,
 *     message: string,
 *     data: {
 *       borelog_id: string,
 *       version_no: number,
 *       layers: [
 *         {
 *           id: string,
 *           layer_order: number,
 *           description: string,
 *           depth_from_m: number,
 *           depth_to_m: number,
 *           thickness_m: number,
 *           return_water_colour: string,
 *           water_loss: string,
 *           borehole_diameter: number,
 *           remarks: string,
 *           created_at: string (ISO timestamp),
 *           created_by_user_id: string,
 *           samples: [
 *             {
 *               id: string,
 *               sample_order: number,
 *               sample_type: string (SPT|UDS|DS|Core),
 *               depth_mode: string (single|range),
 *               depth_single_m: number,
 *               depth_from_m: number,
 *               depth_to_m: number,
 *               run_length_m: number,
 *               spt_15cm_1: number,
 *               spt_15cm_2: number,
 *               spt_15cm_3: number,
 *               n_value: number,
 *               total_core_length_cm: number,
 *               tcr_percent: number,
 *               rqd_length_cm: number,
 *               rqd_percent: number,
 *               created_at: string (ISO timestamp),
 *               created_by_user_id: string
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   }
 * 
 * Database Tables (Previously Used):
 *   - stratum_layers: Stores geological layers for each borelog version
 *   - stratum_sample_points: Stores test samples within each layer
 * 
 * S3 Storage Path (current):
 *   projects/project_{projectId}/borelogs/borelog_{borelogId}/versions/v{version}/stratum/stratum.json
 * 
 * Legacy fallback path (pre-parquet refactor):
 *   projects/project_{projectId}/borelogs/borelog_{borelogId}/v{version}/stratum.json
 * 
 * =============================================================================
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { createStorageClient, StorageClient } from '../storage';

// Schema for query parameters
const GetStratumDataSchema = z.object({
  borelog_id: z.string().uuid(),
  version_no: z.string().transform(val => parseInt(val, 10)),
});

// Interface for stratum layer as stored in S3
interface StratumLayerS3 {
  id: string;
  layer_order: number;
  description: string | null;
  depth_from_m: number | null;
  depth_to_m: number | null;
  thickness_m: number | null;
  return_water_colour: string | null;
  water_loss: string | null;
  borehole_diameter: number | null;
  remarks: string | null;
  created_at: string | null;
  created_by_user_id: string | null;
  samples: StratumSampleS3[];
}

// Interface for sample point as stored in S3
interface StratumSampleS3 {
  id: string;
  sample_order: number;
  sample_type: string | null;
  depth_mode: string | null;
  depth_single_m: number | null;
  depth_from_m: number | null;
  depth_to_m: number | null;
  run_length_m: number | null;
  spt_15cm_1: number | null;
  spt_15cm_2: number | null;
  spt_15cm_3: number | null;
  n_value: number | null;
  total_core_length_cm: number | null;
  tcr_percent: number | null;
  rqd_length_cm: number | null;
  rqd_percent: number | null;
  created_at: string | null;
  created_by_user_id: string | null;
}

// Interface for stratum.json file structure
interface StratumDataFile {
  borelog_id: string;
  version_no: number;
  project_id: string;
  layers: StratumLayerS3[];
  created_at?: string;
  updated_at?: string;
}

// Interface for metadata.json file structure
interface BorelogMetadata {
  project_id: string;
  borelog_id: string;
  latest_version?: number;
  latest_approved?: number;
  versions?: Array<{
    version: number;
    status: string;
    created_at?: string;
    created_by?: string;
  }>;
}

/**
 * Find project_id for a borelog by scanning S3 for its metadata
 * This is needed because we only have borelog_id but need project_id for the S3 path
 */
async function findBorelogBasePath(
  storageClient: StorageClient,
  borelogId: string
): Promise<{ projectId: string; basePath: string } | null> {
  try {
    const keys = await storageClient.listFiles('projects/', 20000);
    const metadataKeys = keys.filter(k =>
      k.endsWith('/metadata.json') &&
      k.includes('/borelogs/') &&
      !k.includes('/versions/')
    );

    for (const key of metadataKeys) {
      try {
        const buf = await storageClient.downloadFile(key);
        const meta = JSON.parse(buf.toString('utf-8'));
        if (meta?.borelog_id === borelogId && meta?.project_id) {
          const basePath = key.replace(/\/metadata\.json$/, '');
          return { projectId: meta.project_id, basePath };
        }
      } catch {
        continue;
      }
    }

    logger.warn('Could not find project for borelog in S3', { borelogId });
    return null;
  } catch (error) {
    logger.error('Error finding project for borelog', { error, borelogId });
    return null;
  }
}

/**
 * Read metadata.json for a borelog
 */
async function readBorelogMetadata(
  storageClient: StorageClient,
  basePath: string,
  projectId: string,
  borelogId: string
): Promise<BorelogMetadata | null> {
  try {
    const metadataKey = `${basePath}/metadata.json`;
    
    if (!(await storageClient.fileExists(metadataKey))) {
      logger.warn('Metadata file not found', { metadataKey });
      return null;
    }

    const buffer = await storageClient.downloadFile(metadataKey);
    const metadata = JSON.parse(buffer.toString('utf-8')) as BorelogMetadata;
    
    // Ensure project_id and borelog_id are set
    metadata.project_id = projectId;
    metadata.borelog_id = borelogId;
    
    logger.debug('Read borelog metadata', { projectId, borelogId, metadata });
    return metadata;
  } catch (error) {
    logger.error('Error reading borelog metadata', { error, projectId, borelogId });
    return null;
  }
}

/**
 * Read stratum.json for a specific borelog version
 */
async function readStratumData(
  storageClient: StorageClient,
  basePath: string,
  versionNo: number
): Promise<StratumDataFile | null> {
  try {
    // New parquet-backed path (Node stores JSON alongside parquet for UI reads)
    const stratumKey = `${basePath}/versions/v${versionNo}/stratum/stratum.json`;
    // Legacy path kept for backward compatibility
    const legacyStratumKey = `${basePath}/v${versionNo}/stratum.json`;
    const keysToTry = [stratumKey, legacyStratumKey];

    for (const key of keysToTry) {
      const exists = await storageClient.fileExists(key);
      if (!exists) {
        continue;
      }

      logger.debug('Attempting to read stratum data', { stratumKey: key });

      const buffer = await storageClient.downloadFile(key);
      const stratumData = JSON.parse(buffer.toString('utf-8')) as StratumDataFile;

      logger.debug('Read stratum data', { 
        stratumKey: key,
        versionNo, 
        layerCount: stratumData.layers?.length || 0 
      });

      return stratumData;
    }

    logger.warn('Stratum data file not found', { keysTried: keysToTry });
    return null;
  } catch (error) {
    logger.error('Error reading stratum data', { error, basePath, versionNo });
    return null;
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Getting stratum data from S3', { queryParams: event.queryStringParameters });

    // Parse and validate query parameters
    const queryParams = event.queryStringParameters || {};
    const validatedParams = GetStratumDataSchema.parse(queryParams);

    const { borelog_id, version_no } = validatedParams;

    // Log S3 read operation
    logger.info(`[S3 READ ENABLED] getStratumData borelog=${borelog_id} version=${version_no}`);
    console.log(`[S3 READ ENABLED] getStratumData borelog=${borelog_id} version=${version_no}`);

    // Initialize storage client
    let storageClient: StorageClient;
    try {
      storageClient = createStorageClient();
    } catch (error) {
      logger.error('Failed to create storage client', { error });
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,OPTIONS'
        },
        body: JSON.stringify({
          success: false,
          message: 'Failed to initialize storage',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      };
    }

    // Step 1: Find project_id for this borelog
    const borelogLookup = await findBorelogBasePath(storageClient, borelog_id);
    
    if (!borelogLookup) {
      logger.warn('Borelog not found in S3 storage', { borelog_id });
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,OPTIONS'
        },
        body: JSON.stringify({
          success: false,
          message: 'Borelog not found',
          error: `No borelog found with ID: ${borelog_id}`
        })
      };
    }

    const { projectId, basePath } = borelogLookup;

    // Step 2: Read metadata to verify version exists
    const metadata = await readBorelogMetadata(storageClient, basePath, projectId, borelog_id);
    
    if (!metadata) {
      logger.warn('Borelog metadata not found', { projectId, borelog_id });
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,OPTIONS'
        },
        body: JSON.stringify({
          success: false,
          message: 'Borelog metadata not found',
          error: `Could not read metadata for borelog: ${borelog_id}`
        })
      };
    }

    // Step 3: Read stratum data for the specified version
    const stratumData = await readStratumData(storageClient, basePath, version_no);

    if (!stratumData) {
      // Return empty layers array if stratum data not found
      // This matches the behavior when DB returns no results
      logger.info('No stratum data found for version, returning empty layers', { 
        borelog_id, 
        version_no 
      });
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          message: 'Stratum data retrieved successfully',
          data: {
            borelog_id,
            version_no,
            layers: []
          }
        })
      };
    }

    // Step 4: Transform data to match expected response format
    // The stratum.json file should already have the nested structure,
    // but we ensure all fields are present and sorted correctly
    const layers = (stratumData.layers || [])
      .map(layer => ({
        id: layer.id,
        layer_order: layer.layer_order,
        description: layer.description,
        depth_from_m: layer.depth_from_m,
        depth_to_m: layer.depth_to_m,
        thickness_m: layer.thickness_m,
        return_water_colour: layer.return_water_colour,
        water_loss: layer.water_loss,
        borehole_diameter: layer.borehole_diameter,
        remarks: layer.remarks,
        created_at: layer.created_at,
        created_by_user_id: layer.created_by_user_id,
        samples: (layer.samples || [])
          .map(sample => ({
            id: sample.id,
            sample_order: sample.sample_order,
            sample_type: sample.sample_type,
            depth_mode: sample.depth_mode,
            depth_single_m: sample.depth_single_m,
            depth_from_m: sample.depth_from_m,
            depth_to_m: sample.depth_to_m,
            run_length_m: sample.run_length_m,
            spt_15cm_1: sample.spt_15cm_1,
            spt_15cm_2: sample.spt_15cm_2,
            spt_15cm_3: sample.spt_15cm_3,
            n_value: sample.n_value,
            total_core_length_cm: sample.total_core_length_cm,
            tcr_percent: sample.tcr_percent,
            rqd_length_cm: sample.rqd_length_cm,
            rqd_percent: sample.rqd_percent,
            created_at: sample.created_at,
            created_by_user_id: sample.created_by_user_id
          }))
          .sort((a, b) => (a.sample_order || 0) - (b.sample_order || 0))
      }))
      .sort((a, b) => (a.layer_order || 0) - (b.layer_order || 0));

    logger.info('Stratum data retrieved successfully from S3', { 
      borelog_id, 
      version_no, 
      layers_count: layers.length 
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        message: 'Stratum data retrieved successfully',
        data: {
          borelog_id,
          version_no,
          layers
        }
      })
    };

  } catch (error) {
    logger.error('Error getting stratum data:', error);
    
    // Check if it's a validation error
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,OPTIONS'
        },
        body: JSON.stringify({
          success: false,
          message: 'Invalid request parameters',
          error: error.errors.map(e => e.message).join(', ')
        })
      };
    }
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({
        success: false,
        message: 'Failed to get stratum data',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
