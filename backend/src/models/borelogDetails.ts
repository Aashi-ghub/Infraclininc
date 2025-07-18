import { v4 as uuidv4 } from 'uuid';
import { query } from '../db';
import { BorelogDetails } from '../types/common';
import { BorelogDetailsInput } from '../utils/validateInput';
import { logger } from '../utils/logger';

export async function insertBorelogDetails(data: BorelogDetailsInput): Promise<BorelogDetails> {
  try {
    logger.info('Inserting borelog details', { borelog_id: data.borelog_id });
    
    // First, we need to check if the borelog_id exists in the boreloge table
    const checkBorelogSql = `
      SELECT COUNT(*) as count FROM boreloge WHERE borelog_id = $1;
    `;
    
    const checkResult = await query<{ count: string }>(checkBorelogSql, [data.borelog_id]);
    
    // If borelog doesn't exist in boreloge table, we need to check if we have valid project and substructure
    if (parseInt(checkResult[0].count) === 0) {
      logger.info('Borelog not found in boreloge table, creating new entry', { borelog_id: data.borelog_id });
      
      // First, check for a valid substructure to use
      const substructureQuery = `
        SELECT substructure_id, project_id FROM sub_structures LIMIT 1;
      `;
      
      const substructures = await query<{ substructure_id: string, project_id: string }>(substructureQuery, []);
      
      if (substructures.length === 0) {
        throw new Error('Cannot create borelog details: required project or substructure does not exist');
      }
      
      // Use the first available substructure and its project
      const { substructure_id, project_id } = substructures[0];
      
      // Create a new entry in boreloge table with valid references
      const createBorelogSql = `
        INSERT INTO boreloge (
          borelog_id,
          substructure_id,
          project_id,
          type,
          created_by_user_id
        )
        VALUES (
          $1, $2, $3, 'Geological', $4
        )
        ON CONFLICT (borelog_id) DO NOTHING;
      `;
      
      try {
        await query(createBorelogSql, [
          data.borelog_id, 
          substructure_id, 
          project_id,
          data.created_by_user_id || null
        ]);
        logger.info('Created new entry in boreloge table', { 
          borelog_id: data.borelog_id,
          substructure_id,
          project_id
        });
      } catch (borelogError) {
        logger.error('Failed to create boreloge entry', { 
          error: borelogError, 
          borelog_id: data.borelog_id,
          errorMessage: (borelogError as Error).message
        });
        
        throw new Error('Cannot create borelog details: failed to create required boreloge entry');
      }
    }
    
    // Now insert into borelog_details
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

    type DbResult = Omit<BorelogDetails, 'coordinate'> & {
      coordinate: string | null;
    };

    const result = await query<DbResult>(sql, values);
    const borelogDetails = { ...result[0], coordinate: undefined } as BorelogDetails;
    
    if (data.coordinate) {
      borelogDetails.coordinate = data.coordinate;
    }

    logger.info('Borelog details inserted successfully', { borelog_id: data.borelog_id });
    return borelogDetails;
  } catch (error) {
    logger.error('Error inserting borelog details', { 
      error, 
      borelog_id: data.borelog_id,
      errorMessage: (error as Error).message,
      errorStack: (error as Error).stack
    });
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
    coordinate_json: any; // Changed from string | null to any
  };

  const result = await query<DbResult>(sql, [project_id]);

  return result.map(row => {
    const log = { ...row, coordinate: undefined } as BorelogDetails;
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
    coordinate_json: any; // Changed from string | null to any
  };

  const result = await query<DbResult>(sql, [borelog_id]);
  
  if (result.length === 0) {
    return null;
  }

  const log = { ...result[0], coordinate: undefined } as BorelogDetails;
  if (result[0].coordinate_json) {
    try {
      // Check if coordinate_json is already an object or needs parsing
      const geoJson = typeof result[0].coordinate_json === 'string' 
        ? JSON.parse(result[0].coordinate_json) 
        : result[0].coordinate_json;
        
      log.coordinate = {
        type: 'Point' as const,
        coordinates: geoJson.coordinates
      };
    } catch (parseError) {
      logger.error('Error parsing coordinate JSON', { 
        error: parseError, 
        coordinate_json: result[0].coordinate_json 
      });
      // Continue without the coordinate data
    }
  }
  
  // Remove coordinate_json from the result
  delete (log as any).coordinate_json;

  return log;
} 