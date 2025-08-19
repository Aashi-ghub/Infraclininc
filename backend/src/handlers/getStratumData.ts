import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { getPool } from '../db';

let pool: Pool | null = null;

// Schema for query parameters
const GetStratumDataSchema = z.object({
  borelog_id: z.string().uuid(),
  version_no: z.string().transform(val => parseInt(val, 10)),
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Getting stratum data', { queryParams: event.queryStringParameters });

    // Parse and validate query parameters
    const queryParams = event.queryStringParameters || {};
    const validatedParams = GetStratumDataSchema.parse(queryParams);

    const { borelog_id, version_no } = validatedParams;

    pool = await getPool();
    const client = await pool.connect();

    try {
      // Get stratum layers with their sample points
      const result = await client.query(
        `SELECT 
          sl.id as layer_id,
          sl.layer_order,
          sl.description as layer_description,
          sl.depth_from_m as layer_depth_from_m,
          sl.depth_to_m as layer_depth_to_m,
          sl.thickness_m as layer_thickness_m,
          sl.return_water_colour as layer_return_water_colour,
          sl.water_loss as layer_water_loss,
          sl.borehole_diameter as layer_borehole_diameter,
          sl.remarks as layer_remarks,
          sl.created_at as layer_created_at,
          sl.created_by_user_id as layer_created_by,
          
          ssp.id as sample_id,
          ssp.sample_order as sample_order,
          ssp.sample_type as sample_type,
          ssp.depth_mode as sample_depth_mode,
          ssp.depth_single_m as sample_depth_single_m,
          ssp.depth_from_m as sample_depth_from_m,
          ssp.depth_to_m as sample_depth_to_m,
          ssp.run_length_m as sample_run_length_m,
          ssp.spt_15cm_1 as sample_spt_15cm_1,
          ssp.spt_15cm_2 as sample_spt_15cm_2,
          ssp.spt_15cm_3 as sample_spt_15cm_3,
          ssp.n_value as sample_n_value,
          ssp.total_core_length_cm as sample_total_core_length_cm,
          ssp.tcr_percent as sample_tcr_percent,
          ssp.rqd_length_cm as sample_rqd_length_cm,
          ssp.rqd_percent as sample_rqd_percent,
          ssp.created_at as sample_created_at,
          ssp.created_by_user_id as sample_created_by
        FROM stratum_layers sl
        LEFT JOIN stratum_sample_points ssp ON sl.id = ssp.stratum_layer_id
        WHERE sl.borelog_id = $1 AND sl.version_no = $2
        ORDER BY sl.layer_order, ssp.sample_order`,
        [borelog_id, version_no]
      );

      // Transform the flat result into nested structure
      const layersMap = new Map();
      
      result.rows.forEach(row => {
        const layerId = row.layer_id;
        
        if (!layersMap.has(layerId)) {
          // Create new layer
          layersMap.set(layerId, {
            id: layerId,
            layer_order: row.layer_order,
            description: row.layer_description,
            depth_from_m: row.layer_depth_from_m,
            depth_to_m: row.layer_depth_to_m,
            thickness_m: row.layer_thickness_m,
            return_water_colour: row.layer_return_water_colour,
            water_loss: row.layer_water_loss,
            borehole_diameter: row.layer_borehole_diameter,
            remarks: row.layer_remarks,
            created_at: row.layer_created_at,
            created_by_user_id: row.layer_created_by,
            samples: []
          });
        }
        
        // Add sample point if it exists
        if (row.sample_id) {
          const layer = layersMap.get(layerId);
          layer.samples.push({
            id: row.sample_id,
            sample_order: row.sample_order,
            sample_type: row.sample_type,
            depth_mode: row.sample_depth_mode,
            depth_single_m: row.sample_depth_single_m,
            depth_from_m: row.sample_depth_from_m,
            depth_to_m: row.sample_depth_to_m,
            run_length_m: row.sample_run_length_m,
            spt_15cm_1: row.sample_spt_15cm_1,
            spt_15cm_2: row.sample_spt_15cm_2,
            spt_15cm_3: row.sample_spt_15cm_3,
            n_value: row.sample_n_value,
            total_core_length_cm: row.sample_total_core_length_cm,
            tcr_percent: row.sample_tcr_percent,
            rqd_length_cm: row.sample_rqd_length_cm,
            rqd_percent: row.sample_rqd_percent,
            created_at: row.sample_created_at,
            created_by_user_id: row.sample_created_by
          });
        }
      });

      // Convert map to array and sort by layer_order
      const layers = Array.from(layersMap.values()).sort((a, b) => a.layer_order - b.layer_order);

      logger.info('Stratum data retrieved successfully', { 
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

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Error getting stratum data:', error);
    
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
