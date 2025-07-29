import * as db from '../db';
import { logger } from '../utils/logger';

export interface Structure {
  structure_id: string;
  project_id: string;
  type: 'Tunnel' | 'Bridge' | 'LevelCrossing' | 'Viaduct' | 'Embankment' | 'Alignment' | 'Yeard' | 'StationBuilding' | 'Building' | 'SlopeStability';
  description?: string;
  created_at: Date;
  updated_at: Date;
  created_by_user_id?: string;
}

export interface Substructure {
  substructure_id: string;
  structure_id: string;
  project_id: string;
  type: 'P1' | 'P2' | 'M' | 'E' | 'Abutment1' | 'Abutment2' | 'LC' | 'Right side' | 'Left side';
  remark?: string;
  created_at: Date;
  updated_at: Date;
  created_by_user_id?: string;
}

export const getStructuresByProject = async (projectId: string): Promise<Structure[]> => {
  try {
    const rows = await db.query<Structure>(
      `SELECT 
        structure_id,
        project_id,
        type,
        description,
        created_at,
        updated_at,
        created_by_user_id
      FROM structure
      WHERE project_id = $1
      ORDER BY created_at DESC`,
      [projectId]
    );
    
    return rows.map(row => ({
      ...row,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    }));
  } catch (error) {
    logger.error('Error retrieving structures by project:', error);
    throw error;
  }
};

export const getStructureById = async (structureId: string): Promise<Structure | null> => {
  try {
    const rows = await db.query<Structure>(
      `SELECT 
        structure_id,
        project_id,
        type,
        description,
        created_at,
        updated_at,
        created_by_user_id
      FROM structure
      WHERE structure_id = $1`,
      [structureId]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    const row = rows[0];
    return {
      ...row,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  } catch (error) {
    logger.error('Error retrieving structure by ID:', error);
    throw error;
  }
};

export const createStructure = async (
  structureData: Omit<Structure, 'structure_id' | 'created_at' | 'updated_at'>
): Promise<Structure> => {
  try {
    const structureId = require('uuid').v4();
    const rows = await db.query<Structure>(
      `INSERT INTO structure (
        structure_id, project_id, type, description, created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING structure_id, project_id, type, description, created_at, updated_at, created_by_user_id`,
      [
        structureId,
        structureData.project_id,
        structureData.type,
        structureData.description,
        structureData.created_by_user_id
      ]
    );
    
    const row = rows[0];
    return {
      ...row,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  } catch (error) {
    logger.error('Error creating structure:', error);
    throw error;
  }
};

export const getSubstructuresByStructure = async (structureId: string): Promise<Substructure[]> => {
  try {
    const rows = await db.query<Substructure>(
      `SELECT 
        substructure_id,
        structure_id,
        project_id,
        type,
        remark,
        created_at,
        updated_at,
        created_by_user_id
      FROM sub_structures
      WHERE structure_id = $1
      ORDER BY created_at DESC`,
      [structureId]
    );
    
    return rows.map(row => ({
      ...row,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    }));
  } catch (error) {
    logger.error('Error retrieving substructures by structure:', error);
    throw error;
  }
};

export const getSubstructuresByProject = async (projectId: string): Promise<Substructure[]> => {
  try {
    const rows = await db.query<Substructure>(
      `SELECT 
        substructure_id,
        structure_id,
        project_id,
        type,
        remark,
        created_at,
        updated_at,
        created_by_user_id
      FROM sub_structures
      WHERE project_id = $1
      ORDER BY created_at DESC`,
      [projectId]
    );
    
    return rows.map(row => ({
      ...row,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    }));
  } catch (error) {
    logger.error('Error retrieving substructures by project:', error);
    throw error;
  }
};

export const getSubstructureById = async (substructureId: string): Promise<Substructure | null> => {
  try {
    const rows = await db.query<Substructure>(
      `SELECT 
        substructure_id,
        structure_id,
        project_id,
        type,
        remark,
        created_at,
        updated_at,
        created_by_user_id
      FROM sub_structures
      WHERE substructure_id = $1`,
      [substructureId]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    const row = rows[0];
    return {
      ...row,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  } catch (error) {
    logger.error('Error retrieving substructure by ID:', error);
    throw error;
  }
};

export const createSubstructure = async (
  substructureData: Omit<Substructure, 'substructure_id' | 'created_at' | 'updated_at'>
): Promise<Substructure> => {
  try {
    const substructureId = require('uuid').v4();
    const rows = await db.query<Substructure>(
      `INSERT INTO sub_structures (
        substructure_id, structure_id, project_id, type, remark, created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING substructure_id, structure_id, project_id, type, remark, created_at, updated_at, created_by_user_id`,
      [
        substructureId,
        substructureData.structure_id,
        substructureData.project_id,
        substructureData.type,
        substructureData.remark,
        substructureData.created_by_user_id
      ]
    );
    
    const row = rows[0];
    return {
      ...row,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  } catch (error) {
    logger.error('Error creating substructure:', error);
    throw error;
  }
}; 