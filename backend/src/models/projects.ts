import * as db from '../db';
import { logger } from '../utils/logger';

export interface Project {
  project_id: string;
  name: string;
  location?: string;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export const getAllProjects = async (): Promise<Project[]> => {
  try {
    const rows = await db.query<Project>(
      `SELECT 
        project_id,
        name,
        location,
        created_by,
        created_at,
        updated_at
      FROM projects
      ORDER BY created_at DESC`
    );
    
    logger.info(`Retrieved ${rows.length} projects from database`);
    
    return rows.map(row => ({
      ...row,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    }));
  } catch (error) {
    logger.error('Error retrieving projects from database:', error);
    throw error;
  }
};

export const getProjectById = async (projectId: string): Promise<Project | null> => {
  try {
    const rows = await db.query<Project>(
      `SELECT 
        project_id,
        name,
        location,
        created_by,
        created_at,
        updated_at
      FROM projects
      WHERE project_id = $1`,
      [projectId]
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
    logger.error('Error retrieving project by ID from database:', error);
    throw error;
  }
};

export const createProject = async (projectData: Omit<Project, 'project_id' | 'created_at' | 'updated_at'>): Promise<Project> => {
  try {
    const projectId = require('uuid').v4();
    const rows = await db.query<Project>(
      `INSERT INTO projects (project_id, name, location, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING project_id, name, location, created_by, created_at, updated_at`,
      [projectId, projectData.name, projectData.location, projectData.created_by]
    );
    
    const row = rows[0];
    return {
      ...row,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  } catch (error) {
    logger.error('Error creating project in database:', error);
    throw error;
  }
}; 