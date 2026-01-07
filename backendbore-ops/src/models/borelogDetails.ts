import { query } from '../db';
import { BorelogDetails } from '../types/common';
import { BorelogDetailsInput } from '../utils/validateInput';
import { logger } from '../utils/logger';

export async function insertBorelogDetails(data: BorelogDetailsInput): Promise<BorelogDetails> {
  // First check if the geological log exists
  const checkSql = `
    SELECT EXISTS(SELECT 1 FROM geological_log WHERE borelog_id = $1) as exists
  `;
  const checkResult = await query<{ exists: boolean }>(checkSql, [data.borelog_id]);
  
  if (!checkResult[0]?.exists) {
    throw new Error(`Geological log with ID ${data.borelog_id} does not exist in geological_log table`);
  }

  // Check if borelog_details already exists for this borelog_id
  const checkDetailsSql = `
    SELECT EXISTS(SELECT 1 FROM borelog_details WHERE borelog_id = $1) as exists
  `;
  const checkDetailsResult = await query<{ exists: boolean }>(checkDetailsSql, [data.borelog_id]);
  
  if (checkDetailsResult[0]?.exists) {
    throw new Error(`Borelog details already exist for borelog ID ${data.borelog_id}. Use update instead.`);
  }

  const sql = `
    INSERT INTO borelog_details (
      borelog_id,
      number,
      msl,
      boring_method,
      hole_diameter,
      commencement_date,
      completion_date,
      standing_water_level,
      termination_depth,
      coordinate,
      stratum_description,
      stratum_depth_from,
      stratum_depth_to,
      stratum_thickness_m,
      remarks
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15
    )
    RETURNING *;
  `;

  const values = [
    data.borelog_id,
    data.number,
    data.msl,
    data.boring_method,
    data.hole_diameter,
    data.commencement_date,
    data.completion_date,
    data.standing_water_level,
    data.termination_depth,
    data.coordinate ? `POINT(${data.coordinate.coordinates[0]} ${data.coordinate.coordinates[1]})` : null,
    data.stratum_description,
    data.stratum_depth_from,
    data.stratum_depth_to,
    data.stratum_thickness_m,
    data.remarks
  ];

  try {
    const result = await query<BorelogDetails>(sql, values);
    
    // Transform the result to handle coordinate conversion
    const dbResult = result[0] as any;
    
    return {
      ...dbResult,
      coordinate: dbResult.coordinate ? {
        type: 'Point' as const,
        coordinates: dbResult.coordinate.replace('POINT(', '').replace(')', '').split(' ').map(Number) as [number, number]
      } : undefined
    };
  } catch (error) {
    logger.error('Error inserting borelog details', { error, borelog_id: data.borelog_id });
    throw error;
  }
}

export async function getBorelogsByProjectId(project_id: string): Promise<BorelogDetails[]> {
  const sql = `
    SELECT bd.*, gl.project_name
    FROM borelog_details bd
    INNER JOIN geological_log gl ON gl.borelog_id = bd.borelog_id
    WHERE gl.project_name = $1
    ORDER BY bd.created_at DESC
  `;

  try {
    const result = await query<BorelogDetails>(sql, [project_id]);
    
    // Transform the result to handle coordinate conversion
    return result.map((row: any) => ({
      ...row,
      coordinate: row.coordinate ? {
        type: 'Point' as const,
        coordinates: row.coordinate.replace('POINT(', '').replace(')', '').split(' ').map(Number) as [number, number]
      } : undefined
    }));
  } catch (error) {
    logger.error('Error getting borelogs by project ID', { error, project_id });
    throw error;
  }
}

export async function getBorelogDetailsById(borelog_id: string): Promise<BorelogDetails | null> {
  const sql = `
    SELECT * FROM borelog_details WHERE borelog_id = $1
  `;

  try {
    const result = await query<BorelogDetails>(sql, [borelog_id]);
    
    if (result.length === 0) {
      return null;
    }
    
    // Transform the result to handle coordinate conversion
    const dbResult = result[0] as any;
    
    return {
      ...dbResult,
      coordinate: dbResult.coordinate ? {
        type: 'Point' as const,
        coordinates: dbResult.coordinate.replace('POINT(', '').replace(')', '').split(' ').map(Number) as [number, number]
      } : undefined
    };
  } catch (error) {
    logger.error('Error getting borelog details by ID', { error, borelog_id });
    throw error;
  }
}

export async function getBorelogDetailsByBorelogId(borelog_id: string): Promise<BorelogDetails[]> {
  const sql = `
    SELECT bd.*, gl.project_name
    FROM borelog_details bd
    INNER JOIN geological_log gl ON gl.borelog_id = bd.borelog_id
    WHERE bd.borelog_id = $1
    ORDER BY bd.created_at DESC
  `;

  try {
    const result = await query<BorelogDetails>(sql, [borelog_id]);
    
    // Transform the result to handle coordinate conversion
    return result.map((row: any) => ({
      ...row,
      coordinate: row.coordinate ? {
        type: 'Point' as const,
        coordinates: row.coordinate.replace('POINT(', '').replace(')', '').split(' ').map(Number) as [number, number]
      } : undefined
    }));
  } catch (error) {
    logger.error('Error getting borelog details by borelog ID', { error, borelog_id });
    throw error;
  }
} 