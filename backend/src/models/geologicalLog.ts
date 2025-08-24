import { v4 as uuidv4 } from 'uuid';
import { query } from '../db';
import { GeologicalLog } from '../types/common';
import { GeologicalLogInput } from '../utils/validateInput';
import { logger } from '../utils/logger';

// Define PostgreSQL error interface
interface PostgresError extends Error {
  constraint?: string;
  code?: string;
  detail?: string;
}

export async function insertGeologicalLog(data: GeologicalLogInput): Promise<GeologicalLog> {
  const borelog_id = uuidv4();
  
  // First check if the user exists
  if (data.created_by_user_id) {
    const userExists = await query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM users WHERE user_id = $1) as exists',
      [data.created_by_user_id]
    );
    
    if (!userExists[0]?.exists) {
      logger.warn(`User with ID ${data.created_by_user_id} does not exist. Using null for created_by_user_id.`);
      data.created_by_user_id = null; // Set to null if user doesn't exist
    }
  }
  
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

  try {
    const result = await query<GeologicalLog>(sql, values);
    return result[0];
  } catch (error) {
    logger.error('Error inserting geological log', { error });
    
    // If the error is related to the foreign key constraint for created_by_user_id
    const pgError = error as PostgresError;
    if (pgError.constraint === 'fk_geo_created_by' || 
        (pgError.code === '23503' && pgError.detail?.includes('created_by_user_id'))) {
      // Try again with null for created_by_user_id
      values[values.length - 1] = null;
      logger.info('Retrying insert with null created_by_user_id');
      const result = await query<GeologicalLog>(sql, values);
      return result[0];
    }
    
    throw error;
  }
}

export async function getGeologicalLogById(borelog_id: string): Promise<GeologicalLog | null> {
  try {
    logger.info(`Fetching geological log with ID: ${borelog_id}`);
    
    const sql = `
      SELECT 
        *,
        ST_AsGeoJSON(coordinate)::json as coordinate_json
      FROM geological_log 
      WHERE borelog_id = $1;
    `;

    type DbResult = Omit<GeologicalLog, 'coordinate'> & {
      coordinate_json: any; // Changed from string | null to any
    };

    const result = await query<DbResult>(sql, [borelog_id]);
    
    if (result.length === 0) {
      logger.info(`No geological log found with ID: ${borelog_id}`);
      return null;
    }

    logger.info(`Found geological log with ID: ${borelog_id}`);
    
    const log = { ...result[0] } as GeologicalLog;
    
    // Handle coordinate conversion safely
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
  } catch (error) {
    logger.error('Error in getGeologicalLogById', { 
      error, 
      borelog_id,
      errorMessage: (error as Error).message,
      errorStack: (error as Error).stack
    });
    throw error;
  }
}

export async function getGeologicalLogsByProjectName(project_name: string): Promise<GeologicalLog[]> {
  const sql = `
    SELECT 
      *,
      ST_AsGeoJSON(coordinate)::json as coordinate_json
    FROM geological_log 
    WHERE LOWER(project_name) LIKE LOWER($1)
    ORDER BY created_at DESC;
  `;

  type DbResult = Omit<GeologicalLog, 'coordinate'> & {
    coordinate_json: any; // Changed from string | null to any
  };

  // Use LIKE for partial matching
  const result = await query<DbResult>(sql, [`%${project_name}%`]);

  logger.info(`SQL query for project name "${project_name}" returned ${result.length} results`);

  return result.map(row => {
    const log = { ...row } as GeologicalLog;
    
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
    
    // Handle size_of_core_pieces_distribution safely
    if (row.size_of_core_pieces_distribution) {
      try {
        if (typeof row.size_of_core_pieces_distribution === 'string') {
          log.size_of_core_pieces_distribution = JSON.parse(row.size_of_core_pieces_distribution);
        }
        // If it's already an object, no need to parse
      } catch (parseError) {
        logger.error('Error parsing size_of_core_pieces_distribution', { 
          error: parseError, 
          data: row.size_of_core_pieces_distribution 
        });
        // Continue with the original value
      }
    }
    
    // Remove coordinate_json from the result
    delete (log as any).coordinate_json;
    
    return log;
  });
}

export async function getAllGeologicalLogs(): Promise<GeologicalLog[]> {
  try {
    logger.info('Fetching all geological logs');
    
    const sql = `
      SELECT 
        *,
        ST_AsGeoJSON(coordinate)::json as coordinate_json
      FROM geological_log 
      ORDER BY created_at DESC;
    `;

    type DbResult = Omit<GeologicalLog, 'coordinate'> & {
      coordinate_json: any;
    };

    const result = await query<DbResult>(sql);
    
    logger.info(`Found ${result.length} geological logs`);
    
    return result.map(row => {
      const log = { ...row } as GeologicalLog;
      
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
      
      // Handle size_of_core_pieces_distribution safely
      if (row.size_of_core_pieces_distribution) {
        try {
          if (typeof row.size_of_core_pieces_distribution === 'string') {
            log.size_of_core_pieces_distribution = JSON.parse(row.size_of_core_pieces_distribution);
          }
          // If it's already an object, no need to parse
        } catch (parseError) {
          logger.error('Error parsing size_of_core_pieces_distribution', { 
            error: parseError, 
            data: row.size_of_core_pieces_distribution 
          });
          // Continue with the original value
        }
      }
      
      // Remove coordinate_json from the result
      delete (log as any).coordinate_json;
      
      return log;
    });
  } catch (error) {
    logger.error('Error in getAllGeologicalLogs', { 
      error,
      errorMessage: (error as Error).message,
      errorStack: (error as Error).stack
    });
    throw error;
  }
} 

export async function updateGeologicalLog(borelog_id: string, data: Partial<GeologicalLogInput>): Promise<GeologicalLog | null> {
  try {
    logger.info(`Updating geological log with ID: ${borelog_id}`);
    
    // First check if the log exists
    const existingLog = await getGeologicalLogById(borelog_id);
    if (!existingLog) {
      logger.warn(`No geological log found with ID: ${borelog_id}`);
      return null;
    }

    // Build the SET part of the SQL query dynamically based on the provided fields
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Add each field that needs to be updated
    for (const [key, value] of Object.entries(data)) {
      // Special handling for coordinate field
      if (key === 'coordinate' && value && typeof value === 'object' && 'coordinates' in value) {
        updateFields.push(`coordinate = ST_SetSRID(ST_Point($${paramIndex}, $${paramIndex + 1}), 4326)`);
        values.push((value as any).coordinates[0], (value as any).coordinates[1]);
        paramIndex += 2;
      }
      // Special handling for size_of_core_pieces_distribution field
      else if (key === 'size_of_core_pieces_distribution' && value) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(JSON.stringify(value));
        paramIndex++;
      }
      // Regular fields
      else if (key !== 'borelog_id' && key !== 'created_at' && key !== 'updated_at') {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    // Add updated_at field
    updateFields.push(`updated_at = NOW()`);

    // If no fields to update, return the existing log
    if (updateFields.length === 0) {
      logger.info(`No fields to update for geological log with ID: ${borelog_id}`);
      return existingLog;
    }

    // Build and execute the SQL query
    const sql = `
      UPDATE geological_log
      SET ${updateFields.join(', ')}
      WHERE borelog_id = $${paramIndex}
      RETURNING *,
        ST_AsGeoJSON(coordinate)::json as coordinate_json;
    `;

    values.push(borelog_id);

    type DbResult = Omit<GeologicalLog, 'coordinate'> & {
      coordinate_json: any;
    };

    const result = await query<DbResult>(sql, values);
    
    if (result.length === 0) {
      logger.warn(`Update failed for geological log with ID: ${borelog_id}`);
      return null;
    }

    logger.info(`Successfully updated geological log with ID: ${borelog_id}`);
    
    const log = { ...result[0] } as GeologicalLog;
    
    // Handle coordinate conversion safely
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

    // Handle size_of_core_pieces_distribution safely
    if (log.size_of_core_pieces_distribution && typeof log.size_of_core_pieces_distribution === 'string') {
      try {
        log.size_of_core_pieces_distribution = JSON.parse(log.size_of_core_pieces_distribution as unknown as string);
      } catch (parseError) {
        logger.error('Error parsing size_of_core_pieces_distribution', { 
          error: parseError, 
          data: log.size_of_core_pieces_distribution 
        });
        // Continue with the original value
      }
    }
    
    // Remove coordinate_json from the result
    delete (log as any).coordinate_json;
    
    return log;
  } catch (error) {
    logger.error('Error in updateGeologicalLog', { 
      error, 
      borelog_id,
      errorMessage: (error as Error).message,
      errorStack: (error as Error).stack
    });
    throw error;
  }
} 

export async function deleteGeologicalLog(borelog_id: string): Promise<boolean> {
  try {
    logger.info(`Deleting geological log with ID: ${borelog_id}`);
    
    // First check if the log exists
    const existingLog = await getGeologicalLogById(borelog_id);
    if (!existingLog) {
      logger.warn(`No geological log found with ID: ${borelog_id}`);
      return false;
    }

    // Delete the geological log
    const sql = `
      DELETE FROM geological_log
      WHERE borelog_id = $1
      RETURNING borelog_id;
    `;

    const result = await query<{ borelog_id: string }>(sql, [borelog_id]);
    
    if (result.length === 0) {
      logger.warn(`Delete failed for geological log with ID: ${borelog_id}`);
      return false;
    }

    logger.info(`Successfully deleted geological log with ID: ${borelog_id}`);
    return true;
  } catch (error) {
    logger.error('Error in deleteGeologicalLog', { 
      error, 
      borelog_id,
      errorMessage: (error as Error).message,
      errorStack: (error as Error).stack
    });
    throw error;
  }
} 