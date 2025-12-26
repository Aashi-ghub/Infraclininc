import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { getPool, guardDbRoute } from '../db';

let pool: Pool | null = null;

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
  user_id: z.string().uuid(),
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('saveStratumData');
  if (dbGuard) return dbGuard;

  try {
    logger.info('Saving stratum data', { body: event.body });

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validatedData = SaveStratumDataSchema.parse(body);

    const { borelog_id, version_no, layers, user_id } = validatedData;

    pool = await getPool();
    const client = await pool.connect();
    
    // Set statement timeout to 30 seconds
    await client.query('SET statement_timeout = 30000');

    try {
      logger.info('Starting transaction for stratum data save', { borelog_id, version_no, layer_count: layers.length });
      await client.query('BEGIN');

      // Delete existing stratum data for this borelog version
      logger.info('Deleting existing stratum data');
      await client.query(
        `DELETE FROM stratum_layers WHERE borelog_id = $1 AND version_no = $2`,
        [borelog_id, version_no]
      );

      // Insert new stratum layers
      logger.info('Starting layer insertion');
      for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        const layer = layers[layerIndex];
        const layerOrder = layerIndex + 1;
        logger.info(`Processing layer ${layerOrder}/${layers.length}`, {
          sample_count: layer.samples?.length || 0
        });

        // Insert stratum layer
        const layerResult = await client.query(
          `INSERT INTO stratum_layers (
            borelog_id, version_no, layer_order, description, depth_from_m, depth_to_m, thickness_m,
            return_water_colour, water_loss, borehole_diameter, remarks, created_by_user_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
          [
            borelog_id,
            version_no,
            layerOrder,
            layer.description || null,
            layer.depth_from_m,
            layer.depth_to_m,
            layer.thickness_m,
            layer.return_water_colour || null,
            layer.water_loss || null,
            layer.borehole_diameter,
            layer.remarks || null,
            user_id
          ]
        );

        const stratumLayerId = layerResult.rows[0].id;

        // Insert sample points for this layer
        if (layer.samples && layer.samples.length > 0) {
          logger.info(`Inserting ${layer.samples.length} samples for layer ${layerOrder}`);
          for (let sampleIndex = 0; sampleIndex < layer.samples.length; sampleIndex++) {
            const sample = layer.samples[sampleIndex];
            const sampleOrder = sampleIndex + 1;
            logger.info(`Processing sample ${sampleOrder}/${layer.samples.length} for layer ${layerOrder}`, {
              sample_type: sample.sample_type,
              depth_mode: sample.depth_mode
            });

            await client.query(
              `INSERT INTO stratum_sample_points (
                stratum_layer_id, sample_order, sample_type, depth_mode, depth_single_m,
                depth_from_m, depth_to_m, run_length_m, spt_15cm_1, spt_15cm_2, spt_15cm_3,
                n_value, total_core_length_cm, tcr_percent, rqd_length_cm, rqd_percent,
                created_by_user_id
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
              [
                stratumLayerId,
                sampleOrder,
                sample.sample_type || null,
                sample.depth_mode || 'single',
                sample.depth_single_m,
                sample.depth_from_m,
                sample.depth_to_m,
                sample.run_length_m,
                sample.spt_15cm_1,
                sample.spt_15cm_2,
                sample.spt_15cm_3,
                sample.n_value,
                sample.total_core_length_cm,
                sample.tcr_percent,
                sample.rqd_length_cm,
                sample.rqd_percent,
                user_id
              ]
            );
          }
        }
      }

      await client.query('COMMIT');

      logger.info('Stratum data saved successfully', { borelog_id, version_no, layers_count: layers.length });

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
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

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
