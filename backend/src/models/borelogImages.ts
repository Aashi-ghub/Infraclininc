import { v4 as uuidv4 } from 'uuid';
import { query } from '../db';
import { logger } from '../utils/logger';

export interface BorelogImage {
  image_id: string;
  borelog_id: string;
  image_url: string;
  uploaded_at: Date;
}

export async function insertBorelogImage(borelog_id: string, image_url: string): Promise<BorelogImage> {
  const image_id = uuidv4();
  
  const sql = `
    INSERT INTO borelog_images (
      image_id,
      borelog_id,
      image_url
    )
    VALUES ($1, $2, $3)
    RETURNING *;
  `;

  try {
    logger.info('Inserting borelog image:', { borelog_id, image_url });
    const result = await query<BorelogImage>(sql, [image_id, borelog_id, image_url]);
    logger.info('Successfully inserted borelog image:', { image_id });
    return result[0];
  } catch (error) {
    logger.error('Error inserting borelog image:', { error, borelog_id, image_url });
    throw error;
  }
}

export async function getBorelogImages(borelog_id: string): Promise<BorelogImage[]> {
  const sql = `
    SELECT *
    FROM borelog_images
    WHERE borelog_id = $1
    ORDER BY uploaded_at DESC;
  `;

  try {
    logger.info('Fetching images for borelog:', { borelog_id });
    const result = await query<BorelogImage>(sql, [borelog_id]);
    logger.info(`Found ${result.length} images for borelog:`, { borelog_id });
    return result;
  } catch (error) {
    logger.error('Error fetching borelog images:', { error, borelog_id });
    throw error;
  }
}

export async function deleteBorelogImage(image_id: string): Promise<boolean> {
  const sql = `
    DELETE FROM borelog_images
    WHERE image_id = $1
    RETURNING image_id;
  `;

  try {
    logger.info('Deleting borelog image:', { image_id });
    const result = await query<{ image_id: string }>(sql, [image_id]);
    const success = result.length > 0;
    logger.info('Delete image result:', { success, image_id });
    return success;
  } catch (error) {
    logger.error('Error deleting borelog image:', { error, image_id });
    throw error;
  }
}