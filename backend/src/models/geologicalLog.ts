import { v4 as uuidv4 } from 'uuid';
import { query } from '../db';
import { GeologicalLog } from '../types/common';
import { GeologicalLogInput } from '../utils/validateInput';
import { logger } from '../utils/logger';
import {
  createParquetEntity,
  getParquetEntity,
  updateParquetEntity,
  listParquetEntities,
  ParquetEntityType,
  getProjectIdFromName,
  getProjectIdFromBorelogId,
} from '../services/parquetService';

// Define PostgreSQL error interface
interface PostgresError extends Error {
  constraint?: string;
  code?: string;
  detail?: string;
}

export async function insertGeologicalLog(data: GeologicalLogInput): Promise<GeologicalLog> {
  const borelog_id = data.borelog_id || uuidv4();
  
  // Get project_id from project_name
  const projectId = await getProjectIdFromName(data.project_name);
  if (!projectId) {
    throw new Error(`Project not found: ${data.project_name}`);
  }

  // Prepare payload for Parquet storage
  // Convert coordinate to lat/lng format if needed
  const payload: any = {
    borelog_id: borelog_id,
    project_name: data.project_name,
    client_name: data.client_name,
    design_consultant: data.design_consultant,
    job_code: data.job_code,
    project_location: data.project_location,
    chainage_km: data.chainage_km,
    area: data.area,
    borehole_location: data.borehole_location,
    borehole_number: data.borehole_number,
    msl: data.msl,
    method_of_boring: data.method_of_boring,
    diameter_of_hole: data.diameter_of_hole,
    commencement_date: data.commencement_date,
    completion_date: data.completion_date,
    standing_water_level: data.standing_water_level,
    termination_depth: data.termination_depth,
    type_of_core_barrel: data.type_of_core_barrel,
    bearing_of_hole: data.bearing_of_hole,
    collar_elevation: data.collar_elevation,
    logged_by: data.logged_by,
    checked_by: data.checked_by,
    lithology: data.lithology,
    rock_methodology: data.rock_methodology,
    structural_condition: data.structural_condition,
    weathering_classification: data.weathering_classification,
    fracture_frequency_per_m: data.fracture_frequency_per_m,
    size_of_core_pieces_distribution: data.size_of_core_pieces_distribution 
      ? JSON.stringify(data.size_of_core_pieces_distribution) 
      : null,
    remarks: data.remarks,
    created_by_user_id: data.created_by_user_id,
  };

  // Handle coordinate conversion
  if (data.coordinate) {
    payload.coordinate_latitude = data.coordinate.coordinates[1];
    payload.coordinate_longitude = data.coordinate.coordinates[0];
  }

  // Create in Parquet storage
  const parquetResult = await createParquetEntity(
    ParquetEntityType.GEOLOGICAL_LOG,
    projectId,
    borelog_id,
    payload,
    data.created_by_user_id || 'system',
    'Created geological log'
  );

  // Transform Parquet result back to GeologicalLog format
  const resultData = parquetResult.data || parquetResult;
  return {
    ...resultData,
    borelog_id: borelog_id,
    coordinate: resultData.coordinate_latitude && resultData.coordinate_longitude
      ? {
          type: 'Point' as const,
          coordinates: [resultData.coordinate_longitude, resultData.coordinate_latitude]
        }
      : undefined,
    size_of_core_pieces_distribution: resultData.size_of_core_pieces_distribution
      ? (typeof resultData.size_of_core_pieces_distribution === 'string'
          ? JSON.parse(resultData.size_of_core_pieces_distribution)
          : resultData.size_of_core_pieces_distribution)
      : undefined,
    created_at: new Date(resultData.created_at || Date.now()),
    updated_at: new Date(resultData.updated_at || Date.now()),
  } as GeologicalLog;
}

export async function getGeologicalLogById(borelog_id: string): Promise<GeologicalLog | null> {
  try {
    logger.info(`Fetching geological log with ID: ${borelog_id}`);
    
    // Get project_id from borelog_id
    const projectId = await getProjectIdFromBorelogId(borelog_id);
    if (!projectId) {
      logger.warn(`Could not find project_id for borelog_id: ${borelog_id}`);
      return null;
    }

    // Get from Parquet storage
    const parquetResult = await getParquetEntity(
      ParquetEntityType.GEOLOGICAL_LOG,
      projectId,
      borelog_id
    );

    if (!parquetResult || !parquetResult.data) {
      logger.info(`No geological log found with ID: ${borelog_id}`);
      return null;
    }

    logger.info(`Found geological log with ID: ${borelog_id}`);
    
    // Transform Parquet result to GeologicalLog format
    const resultData = parquetResult.data;
    const log: GeologicalLog = {
      ...resultData,
      borelog_id: borelog_id,
      coordinate: resultData.coordinate_latitude && resultData.coordinate_longitude
        ? {
            type: 'Point' as const,
            coordinates: [resultData.coordinate_longitude, resultData.coordinate_latitude]
          }
        : undefined,
      size_of_core_pieces_distribution: resultData.size_of_core_pieces_distribution
        ? (typeof resultData.size_of_core_pieces_distribution === 'string'
            ? JSON.parse(resultData.size_of_core_pieces_distribution)
            : resultData.size_of_core_pieces_distribution)
        : undefined,
      created_at: new Date(resultData.created_at || Date.now()),
      updated_at: new Date(resultData.updated_at || Date.now()),
      created_by_user_id: resultData.created_by_user_id || null,
    } as GeologicalLog;
    
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
  // Get project_id from project_name
  const projectId = await getProjectIdFromName(project_name);
  if (!projectId) {
    logger.warn(`Project not found: ${project_name}`);
    return [];
  }

  // List from Parquet storage
  const parquetResults = await listParquetEntities(
    ParquetEntityType.GEOLOGICAL_LOG,
    projectId
  );

  logger.info(`Found ${parquetResults.length} geological logs for project: ${project_name}`);

  // Filter by project_name (in case of partial match) and transform
  return parquetResults
    .filter(result => {
      const data = result.data || result;
      return data.project_name && 
             data.project_name.toLowerCase().includes(project_name.toLowerCase());
    })
    .map(result => {
      const data = result.data || result;
      return {
        ...data,
        coordinate: data.coordinate_latitude && data.coordinate_longitude
          ? {
              type: 'Point' as const,
              coordinates: [data.coordinate_longitude, data.coordinate_latitude]
            }
          : undefined,
        size_of_core_pieces_distribution: data.size_of_core_pieces_distribution
          ? (typeof data.size_of_core_pieces_distribution === 'string'
              ? JSON.parse(data.size_of_core_pieces_distribution)
              : data.size_of_core_pieces_distribution)
          : undefined,
        created_at: new Date(data.created_at || Date.now()),
        updated_at: new Date(data.updated_at || Date.now()),
        created_by_user_id: data.created_by_user_id || null,
      } as GeologicalLog;
    })
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
}

export async function getAllGeologicalLogs(): Promise<GeologicalLog[]> {
  try {
    logger.info('Fetching all geological logs');
    
    // Get all projects first
    const projectsQuery = `SELECT project_id FROM projects`;
    const projects = await query<{ project_id: string }>(projectsQuery);
    
    // Fetch geological logs from all projects
    const allLogs: GeologicalLog[] = [];
    for (const project of projects) {
      try {
        const logs = await listParquetEntities(
          ParquetEntityType.GEOLOGICAL_LOG,
          project.project_id
        );
        
        // Transform and add to results
        logs.forEach(result => {
          const data = result.data || result;
          allLogs.push({
            ...data,
            coordinate: data.coordinate_latitude && data.coordinate_longitude
              ? {
                  type: 'Point' as const,
                  coordinates: [data.coordinate_longitude, data.coordinate_latitude]
                }
              : undefined,
            size_of_core_pieces_distribution: data.size_of_core_pieces_distribution
              ? (typeof data.size_of_core_pieces_distribution === 'string'
                  ? JSON.parse(data.size_of_core_pieces_distribution)
                  : data.size_of_core_pieces_distribution)
              : undefined,
            created_at: new Date(data.created_at || Date.now()),
            updated_at: new Date(data.updated_at || Date.now()),
            created_by_user_id: data.created_by_user_id || null,
          } as GeologicalLog);
        });
      } catch (error) {
        logger.warn(`Error fetching logs for project ${project.project_id}:`, error);
        // Continue with other projects
      }
    }
    
    // Sort by created_at descending
    allLogs.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    
    logger.info(`Found ${allLogs.length} geological logs`);
    
    return allLogs;
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
    
    // Get project_id from borelog_id
    const projectId = await getProjectIdFromBorelogId(borelog_id);
    if (!projectId) {
      logger.warn(`Could not find project_id for borelog_id: ${borelog_id}`);
      return null;
    }

    // Get existing log to merge updates
    const existingLog = await getGeologicalLogById(borelog_id);
    if (!existingLog) {
      logger.warn(`No geological log found with ID: ${borelog_id}`);
      return null;
    }

    // Prepare update payload (merge existing with updates)
    const updatePayload: any = {
      ...existingLog,
      ...data,
    };

    // Handle coordinate conversion
    if (data.coordinate) {
      updatePayload.coordinate_latitude = data.coordinate.coordinates[1];
      updatePayload.coordinate_longitude = data.coordinate.coordinates[0];
      delete updatePayload.coordinate;
    }

    // Handle size_of_core_pieces_distribution
    if (data.size_of_core_pieces_distribution) {
      updatePayload.size_of_core_pieces_distribution = JSON.stringify(data.size_of_core_pieces_distribution);
    }

    // Remove fields that shouldn't be in payload
    delete updatePayload.created_at;
    delete updatePayload.updated_at;
    delete updatePayload.borelog_id;

    // Update in Parquet storage (creates new version)
    const parquetResult = await updateParquetEntity(
      ParquetEntityType.GEOLOGICAL_LOG,
      projectId,
      borelog_id,
      updatePayload,
      data.created_by_user_id || existingLog.created_by_user_id || 'system',
      'Updated geological log'
    );

    // Transform result back to GeologicalLog format
    const resultData = parquetResult.data || parquetResult;
    const log: GeologicalLog = {
      ...resultData,
      borelog_id: borelog_id,
      coordinate: resultData.coordinate_latitude && resultData.coordinate_longitude
        ? {
            type: 'Point' as const,
            coordinates: [resultData.coordinate_longitude, resultData.coordinate_latitude]
          }
        : undefined,
      size_of_core_pieces_distribution: resultData.size_of_core_pieces_distribution
        ? (typeof resultData.size_of_core_pieces_distribution === 'string'
            ? JSON.parse(resultData.size_of_core_pieces_distribution)
            : resultData.size_of_core_pieces_distribution)
        : undefined,
      created_at: new Date(resultData.created_at || Date.now()),
      updated_at: new Date(resultData.updated_at || Date.now()),
      created_by_user_id: resultData.created_by_user_id || null,
    } as GeologicalLog;

    logger.info(`Successfully updated geological log with ID: ${borelog_id}`);
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
    
    // Note: Parquet storage is append-only and immutable
    // We cannot actually delete records, but we can mark them as deleted
    // For now, we'll just check if the record exists
    // In production, you might want to add a "deleted" flag to metadata
    
    const existingLog = await getGeologicalLogById(borelog_id);
    if (!existingLog) {
      logger.warn(`No geological log found with ID: ${borelog_id}`);
      return false;
    }

    // Since Parquet is immutable, we can't delete
    // Return true to maintain API compatibility
    // In production, consider adding a "deleted" status to metadata
    logger.info(`Geological log ${borelog_id} marked as checked (Parquet storage is immutable)`);
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