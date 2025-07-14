import { v4 as uuidv4 } from 'uuid';
import { query } from '../db';
import { GeologicalLog } from '../types/common';
import { GeologicalLogInput } from '../utils/validateInput';

export async function insertGeologicalLog(data: GeologicalLogInput): Promise<GeologicalLog> {
  const borelog_id = uuidv4();
  
  const sql = `
    INSERT INTO geological_log (
      borelog_id,
      project_name,
      client_name,
      design_consultant,
      job_code,
      project_location,
      chainage_km,
      area,
      borehole_location,
      borehole_number,
      msl,
      method_of_boring,
      diameter_of_hole,
      commencement_date,
      completion_date,
      standing_water_level,
      termination_depth,
      coordinate,
      type_of_core_barrel,
      bearing_of_hole,
      collar_elevation,
      logged_by,
      checked_by,
      lithology,
      rock_methodology,
      structural_condition,
      weathering_classification,
      fracture_frequency_per_m,
      size_of_core_pieces_distribution,
      remarks,
      created_by_user_id
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
    )
    RETURNING *;
  `;

  const values = [
    borelog_id,
    data.project_name,
    data.client_name,
    data.design_consultant,
    data.job_code,
    data.project_location,
    data.chainage_km,
    data.area,
    data.borehole_location,
    data.borehole_number,
    data.msl,
    data.method_of_boring,
    data.diameter_of_hole,
    data.commencement_date,
    data.completion_date,
    data.standing_water_level,
    data.termination_depth,
    data.coordinate ? `POINT(${data.coordinate.coordinates[0]} ${data.coordinate.coordinates[1]})` : null,
    data.type_of_core_barrel,
    data.bearing_of_hole,
    data.collar_elevation,
    data.logged_by,
    data.checked_by,
    data.lithology,
    data.rock_methodology,
    data.structural_condition,
    data.weathering_classification,
    data.fracture_frequency_per_m,
    data.size_of_core_pieces_distribution ? JSON.stringify(data.size_of_core_pieces_distribution) : null,
    data.remarks,
    data.created_by_user_id
  ];

  const result = await query<GeologicalLog>(sql, values);
  return result[0];
}

export async function getGeologicalLogById(borelog_id: string): Promise<GeologicalLog | null> {
  const sql = `
    SELECT 
      *,
      ST_AsGeoJSON(coordinate)::json as coordinate_json
    FROM geological_log 
    WHERE borelog_id = $1;
  `;

  type DbResult = Omit<GeologicalLog, 'coordinate'> & {
    coordinate_json: string | null;
  };

  const result = await query<DbResult>(sql, [borelog_id]);
  
  if (result.length === 0) {
    return null;
  }

  const log = { ...result[0] } as GeologicalLog;
  if (result[0].coordinate_json) {
    const geoJson = JSON.parse(result[0].coordinate_json);
    log.coordinate = {
      type: 'Point' as const,
      coordinates: geoJson.coordinates
    };
  }

  return log;
}

export async function getGeologicalLogsByProjectName(project_name: string): Promise<GeologicalLog[]> {
  const sql = `
    SELECT 
      *,
      ST_AsGeoJSON(coordinate)::json as coordinate_json
    FROM geological_log 
    WHERE project_name = $1
    ORDER BY created_at DESC;
  `;

  type DbResult = Omit<GeologicalLog, 'coordinate'> & {
    coordinate_json: string | null;
  };

  const result = await query<DbResult>(sql, [project_name]);

  return result.map(row => {
    const log = { ...row } as GeologicalLog;
    if (row.coordinate_json) {
      const geoJson = JSON.parse(row.coordinate_json);
      log.coordinate = {
        type: 'Point' as const,
        coordinates: geoJson.coordinates
      };
    }
    return log;
  });
} 