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

  // Check if the borelog exists in the boreloge table
  const checkBorelogeSql = `
    SELECT EXISTS(SELECT 1 FROM boreloge WHERE borelog_id = $1) as exists
  `;
  const checkBorelogeResult = await query<{ exists: boolean }>(checkBorelogeSql, [data.borelog_id]);
  
  // If the borelog doesn't exist in boreloge table, we need to create it
  if (!checkBorelogeResult[0]?.exists) {
    logger.info(`Creating boreloge record for geological log ID ${data.borelog_id}`);
    
    // Get the project_id from the geological_log table
    const getProjectSql = `
      SELECT project_name FROM geological_log WHERE borelog_id = $1
    `;
    const projectResult = await query<{ project_name: string }>(getProjectSql, [data.borelog_id]);
    
    if (!projectResult.length) {
      throw new Error(`Could not find project name for geological log ID ${data.borelog_id}`);
    }
    
    // Find a substructure to associate with this borelog (using the first available one)
    const getSubstructureSql = `
      SELECT substructure_id, project_id FROM sub_structures LIMIT 1
    `;
    const substructureResult = await query<{ substructure_id: string, project_id: string }>(getSubstructureSql, []);
    
    if (!substructureResult.length) {
      throw new Error(`No substructures found in the database. Please create a substructure first.`);
    }
    
    // Insert into boreloge table
    const insertBorelogeSql = `
      INSERT INTO boreloge (
        borelog_id,
        substructure_id,
        project_id,
        type
      )
      VALUES ($1, $2, $3, 'Geological')
      RETURNING *
    `;
    
    await query(insertBorelogeSql, [
      data.borelog_id,
      substructureResult[0].substructure_id,
      substructureResult[0].project_id
    ]);
    
    logger.info(`Successfully created boreloge record for geological log ID ${data.borelog_id}`);
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
    type DbResult = Omit<BorelogDetails, 'coordinate'> & {
      coordinate: string | null;
    };

    const result = await query<DbResult>(sql, values);
    const borelogDetails = { ...result[0], coordinate: undefined } as BorelogDetails;
    
    if (data.coordinate) {
      borelogDetails.coordinate = data.coordinate;
    }

    return borelogDetails;
  } catch (error) {
    logger.error('Error inserting borelog details', { error });
    throw error;
  }
}

export async function getBorelogsByProjectId(project_id: string): Promise<BorelogDetails[]> {
  const sql = `
    SELECT 
      bd.*,
      ST_AsGeoJSON(bd.coordinate)::json as coordinate_json
    FROM borelog_details bd
    INNER JOIN boreloge b ON b.borelog_id = bd.borelog_id
    WHERE b.project_id = $1
    ORDER BY bd.created_at DESC;
  `;

  type DbResult = Omit<BorelogDetails, 'coordinate'> & {
    coordinate_json: string | null;
  };

  const result = await query<DbResult>(sql, [project_id]);

  return result.map(row => {
    const log = { ...row, coordinate: undefined } as BorelogDetails;
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

export async function getBorelogDetailsById(borelog_id: string): Promise<BorelogDetails | null> {
  const sql = `
    SELECT 
      *,
      ST_AsGeoJSON(coordinate)::json as coordinate_json
    FROM borelog_details 
    WHERE borelog_id = $1;
  `;

  type DbResult = Omit<BorelogDetails, 'coordinate'> & {
    coordinate_json: string | null;
  };

  const result = await query<DbResult>(sql, [borelog_id]);
  
  if (result.length === 0) {
    return null;
  }

  const log = { ...result[0], coordinate: undefined } as BorelogDetails;
  if (result[0].coordinate_json) {
    const geoJson = JSON.parse(result[0].coordinate_json);
    log.coordinate = {
      type: 'Point' as const,
      coordinates: geoJson.coordinates
    };
  }

  return log;
} 

export async function getBorelogDetailsByBorelogId(borelog_id: string): Promise<BorelogDetails[]> {
  try {
    const sql = `
      SELECT 
        *,
        ST_AsGeoJSON(coordinate)::json as coordinate_json
      FROM borelog_details 
      WHERE borelog_id = $1
      ORDER BY created_at DESC;
    `;

    type DbResult = Omit<BorelogDetails, 'coordinate'> & {
      coordinate_json: any; // Changed from string | null to any
    };

    const result = await query<DbResult>(sql, [borelog_id]);

    return result.map(row => {
      const log = { ...row, coordinate: undefined } as BorelogDetails;
      
      // Handle coordinate conversion safely
      if (row.coordinate_json) {
        try {
          // Check if coordinate_json is already an object or needs parsing
          const geoJson = typeof row.coordinate_json === 'string' 
            ? JSON.parse(row.coordinate_json) 
            : row.coordinate_json;
            
          log.coordinate = {
            type: 'Point' as const,
            coordinates: geoJson.coordinates
          };
        } catch (parseError) {
          logger.error('Error parsing coordinate JSON', { 
            error: parseError, 
            coordinate_json: row.coordinate_json 
          });
          // Continue without the coordinate data
        }
      }
      
      // Remove coordinate_json from the result
      delete (log as any).coordinate_json;
      
      return log;
    });
  } catch (error) {
    logger.error('Error in getBorelogDetailsByBorelogId', { 
      error, 
      borelog_id,
      errorMessage: (error as Error).message,
      errorStack: (error as Error).stack
    });
    throw error;
  }
} 