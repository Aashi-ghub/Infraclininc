import { query } from '../db';
import { BorelogDetails, Point } from '../types/common';
import { BorelogDetailsInput } from '../utils/validateInput';

export async function insertBorelogDetails(data: BorelogDetailsInput): Promise<BorelogDetails> {
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
      remarks,
      created_by_user_id
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16
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
    data.remarks,
    data.created_by_user_id
  ];

  const result = await query<BorelogDetails>(sql, values);
  return result[0];
}

export async function getBorelogsByProjectId(project_id: string): Promise<BorelogDetails[]> {
  const sql = `
    SELECT 
      bd.*,
      ST_AsGeoJSON(bd.coordinate)::json as coordinate
    FROM borelog_details bd
    INNER JOIN boreloge b ON b.borelog_id = bd.borelog_id
    WHERE b.project_id = $1
    ORDER BY bd.created_at DESC;
  `;

  const result = await query<BorelogDetails & { coordinate: string }>(sql, [project_id]);

  // Parse the GeoJSON coordinates
  return result.map(log => {
    if (log.coordinate) {
      const geoJson = JSON.parse(log.coordinate as unknown as string);
      log.coordinate = {
        type: 'Point',
        coordinates: geoJson.coordinates
      } as Point;
    }
    return log;
  });
}

export async function getBorelogDetailsById(borelog_id: string): Promise<BorelogDetails | null> {
  const sql = `
    SELECT 
      *,
      ST_AsGeoJSON(coordinate)::json as coordinate
    FROM borelog_details 
    WHERE borelog_id = $1;
  `;

  const result = await query<BorelogDetails & { coordinate: string }>(sql, [borelog_id]);
  
  if (result.length === 0) {
    return null;
  }

  // Parse the GeoJSON coordinate if it exists
  const log = result[0];
  if (log.coordinate) {
    const geoJson = JSON.parse(log.coordinate as unknown as string);
    log.coordinate = {
      type: 'Point',
      coordinates: geoJson.coordinates
    } as Point;
  }

  return log;
} 