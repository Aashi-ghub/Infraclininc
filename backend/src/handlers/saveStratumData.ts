import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { createStorageClient } from '../storage/s3Client';
import { Lambda } from 'aws-sdk';
import { validateToken } from '../utils/validateInput';
import { v4 as uuidv4 } from 'uuid';

// Schema for stratum layer data
const StratumLayerSchema = z.object({
  id: z.string().optional(),
  description: z.string().optional(),
  depth_from_m: z.number().nullable().optional(),
  depth_to_m: z.number().nullable().optional(),
  thickness_m: z.number().nullable().optional(),
  return_water_colour: z.string().optional(),
  water_loss: z.string().optional(),
  borehole_diameter: z.number().nullable().optional(),
  remarks: z.string().optional(),
  samples: z.array(z.object({
    id: z.string().optional(),
    sample_type: z.string().optional(),
    depth_mode: z.enum(['single', 'range']).optional(),
    depth_single_m: z.number().nullable().optional(),
    depth_from_m: z.number().nullable().optional(),
    depth_to_m: z.number().nullable().optional(),
    run_length_m: z.number().nullable().optional(),
    spt_15cm_1: z.number().nullable().optional(),
    spt_15cm_2: z.number().nullable().optional(),
    spt_15cm_3: z.number().nullable().optional(),
    n_value: z.number().nullable().optional(),
    total_core_length_cm: z.number().nullable().optional(),
    tcr_percent: z.number().nullable().optional(),
    rqd_length_cm: z.number().nullable().optional(),
    rqd_percent: z.number().nullable().optional(),
  })).optional(),
});

// Schema for the request body
const SaveStratumDataSchema = z.object({
  borelog_id: z.string().uuid(),
  version_no: z.number(),
  layers: z.array(StratumLayerSchema),
  user_id: z.string().uuid().optional(), // allow deriving from auth token
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Saving stratum data', { body: event.body });

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validatedData = SaveStratumDataSchema.parse(body);

    // Derive user from token if not supplied (keeps behavior compatible with callers that omit user_id)
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = authHeader ? await validateToken(authHeader) : null;
    const derivedUserId = validatedData.user_id || payload?.userId;

    if (!derivedUserId) {
      return createErrorResponse(400, 'Missing user_id', 'user_id is required');
    }

    const { borelog_id, version_no, layers } = validatedData;

    const storageClient = createStorageClient();

    // Locate borelog metadata (new or legacy path) to derive project/base path
    const borelogLookup = await findBorelogBasePath(storageClient, borelog_id);
    if (!borelogLookup) {
      return createErrorResponse(404, 'Borelog not found in storage', 'Borelog not found');
    }

    const { projectId, basePath } = borelogLookup;
    const versionPath = `${basePath}/versions/v${version_no}`;
    const versionMetadataKey = `${versionPath}/metadata.json`;

    const versionExists = await storageClient.fileExists(versionMetadataKey);
    if (!versionExists) {
      return createErrorResponse(404, 'Borelog version not found', 'Requested borelog version does not exist');
    }

    // Persist a JSON snapshot alongside parquet so UI can read stratum data without parquet parsing
    const stratumJsonKey = `${versionPath}/stratum/stratum.json`;
    const nowIso = new Date().toISOString();
    const snapshot = {
      borelog_id,
      version_no,
      project_id: projectId,
      created_at: nowIso,
      updated_at: nowIso,
      layers: (layers || []).map((layer, idx) => {
        const samples = (layer.samples || []).map((sample, sIdx) => ({
          id: sample.id || uuidv4(),
          sample_order: sIdx + 1,
          sample_type: sample.sample_type || null,
          depth_mode: sample.depth_mode || null,
          depth_single_m: sample.depth_single_m ?? null,
          depth_from_m: sample.depth_from_m ?? null,
          depth_to_m: sample.depth_to_m ?? null,
          run_length_m: sample.run_length_m ?? null,
          spt_15cm_1: sample.spt_15cm_1 ?? null,
          spt_15cm_2: sample.spt_15cm_2 ?? null,
          spt_15cm_3: sample.spt_15cm_3 ?? null,
          n_value: sample.n_value ?? null,
          total_core_length_cm: sample.total_core_length_cm ?? null,
          tcr_percent: sample.tcr_percent ?? null,
          rqd_length_cm: sample.rqd_length_cm ?? null,
          rqd_percent: sample.rqd_percent ?? null,
          created_at: nowIso,
          created_by_user_id: derivedUserId,
        }));

        return {
          id: layer.id || uuidv4(),
          layer_order: idx + 1,
          description: layer.description || null,
          depth_from_m: layer.depth_from_m ?? null,
          depth_to_m: layer.depth_to_m ?? null,
          thickness_m: layer.thickness_m ?? null,
          return_water_colour: layer.return_water_colour || null,
          water_loss: layer.water_loss || null,
          borehole_diameter: layer.borehole_diameter ?? null,
          remarks: layer.remarks || null,
          created_at: nowIso,
          created_by_user_id: derivedUserId,
          samples,
        };
      }),
    };

    await storageClient.uploadFile(
      stratumJsonKey,
      Buffer.from(JSON.stringify(snapshot, null, 2), 'utf-8'),
      'application/json'
    );

    // Delegate to Python wrapper to mutate Parquet (Node must not touch Parquet)
    await invokeStratumLambda({
      project_id: projectId,
      borelog_id,
      version_no,
      user_id: derivedUserId,
      layers,
      stratum_data_key: `${versionPath}/stratum/data.parquet`,
      stratum_metadata_key: `${versionPath}/stratum/metadata.json`
    });

    logger.info('Stratum data saved successfully (S3/Python path)', { borelog_id, version_no, layers_count: layers.length });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        message: 'Stratum data saved successfully',
        data: {
          borelog_id,
          version_no,
          layers_saved: layers.length
        }
      })
    };

  } catch (error) {
    logger.error('Error saving stratum data:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({
        success: false,
        message: 'Failed to save stratum data',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Find borelog base path by scanning metadata files in S3
 */
async function findBorelogBasePath(storageClient: ReturnType<typeof createStorageClient>, borelogId: string): Promise<{ projectId: string; basePath: string } | null> {
  // Search metadata files under projects/ looking for matching borelog_id
  const allKeys = await storageClient.listFiles('projects/', 20000);
  const candidateKeys = allKeys.filter(k =>
    k.endsWith('/metadata.json') &&
    k.includes('/borelogs/') &&
    !k.includes('/versions/')
  );

  for (const key of candidateKeys) {
    try {
      const buf = await storageClient.downloadFile(key);
      const meta = JSON.parse(buf.toString('utf-8'));
      if (meta?.borelog_id === borelogId && meta?.project_id) {
        const basePath = key.replace(/\/metadata\.json$/, '');
        return { projectId: meta.project_id, basePath };
      }
    } catch (err) {
      logger.warn('Failed to parse borelog metadata during lookup', { key, err });
    }
  }

  return null;
}

const lambda = new Lambda({ region: process.env.AWS_REGION || 'us-east-1' });
// Resolve parquet Lambda name from env; sanitize to avoid whitespace/quotes
const PARQUET_LAMBDA_FUNCTION_NAME = (() => {
  const raw = process.env.PARQUET_LAMBDA_FUNCTION_NAME;
  const cleaned = raw ? raw.trim().replace(/^["']|["']$/g, '') : '';
  return cleaned || '';
})();

async function invokeStratumLambda(payload: any): Promise<void> {
  if (!PARQUET_LAMBDA_FUNCTION_NAME) {
    throw new Error('PARQUET_LAMBDA_FUNCTION_NAME is not set');
  }

  const params = {
    FunctionName: PARQUET_LAMBDA_FUNCTION_NAME,
    InvocationType: 'RequestResponse' as const,
    Payload: JSON.stringify({
      action: 'save_stratum',
      ...payload
    })
  };

  // Diagnostic: confirm which function name is being invoked at runtime
  console.log('Invoking parquet Lambda', { FunctionName: PARQUET_LAMBDA_FUNCTION_NAME });

  const result = await lambda.invoke(params).promise();

  if (result.FunctionError) {
    const payloadText = result.Payload ? result.Payload.toString() : '';
    throw new Error(`Lambda function error: ${result.FunctionError} ${payloadText}`);
  }

  if (!result.Payload) {
    throw new Error('Empty Lambda response');
  }

  const response = JSON.parse(result.Payload.toString());

  if (response.statusCode && response.statusCode >= 400) {
    const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    throw new Error(body?.error || 'Stratum Lambda failed');
  }
}

function createErrorResponse(statusCode: number, message: string, error: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'POST,OPTIONS'
    },
    body: JSON.stringify({
      success: false,
      message,
      error
    })
  };
}
