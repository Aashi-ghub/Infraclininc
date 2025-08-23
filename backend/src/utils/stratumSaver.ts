import { Pool } from 'pg';
import { logger } from './logger';
import { StratumLayer } from './stratumConverter';

export async function saveStratumData(
  client: Pool,
  borelog_id: string,
  version_no: number,
  layers: StratumLayer[],
  user_id: string
): Promise<void> {
  try {
    // Delete existing stratum data for this borelog version
    await client.query(
      `DELETE FROM stratum_layers WHERE borelog_id = $1 AND version_no = $2`,
      [borelog_id, version_no]
    );

    // Insert new stratum layers
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      const layer = layers[layerIndex];
      const layerOrder = layerIndex + 1;

      // Insert stratum layer
      const layerResult = await client.query(
        `INSERT INTO stratum_layers (
          id,
          borelog_id,
          version_no,
          layer_order,
          description,
          depth_from_m,
          depth_to_m,
          thickness_m,
          return_water_colour,
          water_loss,
          borehole_diameter,
          remarks,
          created_by_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
        [
          layer.id,
          borelog_id,
          version_no,
          layerOrder,
          layer.description,
          layer.depth_from_m,
          layer.depth_to_m,
          layer.thickness_m,
          layer.return_water_colour,
          layer.water_loss,
          layer.borehole_diameter,
          layer.remarks,
          user_id
        ]
      );

      // Insert sample points for this layer
      if (layer.samples && layer.samples.length > 0) {
        for (let sampleIndex = 0; sampleIndex < layer.samples.length; sampleIndex++) {
          const sample = layer.samples[sampleIndex];
          const sampleOrder = sampleIndex + 1;

          await client.query(
            `INSERT INTO stratum_sample_points (
              id,
              stratum_layer_id,
              sample_order,
              sample_type,
              depth_mode,
              depth_single_m,
              depth_from_m,
              depth_to_m,
              run_length_m,
              spt_15cm_1,
              spt_15cm_2,
              spt_15cm_3,
              n_value,
              total_core_length_cm,
              tcr_percent,
              rqd_length_cm,
              rqd_percent,
              created_by_user_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
            [
              sample.id,
              layer.id,
              sampleOrder,
              sample.sample_type,
              sample.depth_mode,
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

    logger.info('Stratum data saved successfully', {
      borelog_id,
      version_no,
      layers_count: layers.length
    });
  } catch (error) {
    logger.error('Error saving stratum data:', error);
    throw error;
  }
}





