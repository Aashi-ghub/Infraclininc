import * as db from '../db';
import { logger } from '../utils/logger';
import { UserRole } from '../utils/validateInput';

export interface Project {
  project_id: string;
  name: string;
  location?: string;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
  created_by_user_id?: string;
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
        updated_at,
        created_by_user_id
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

export const getProjectsByUser = async (userId: string, userRole: UserRole): Promise<Project[]> => {
  try {
    let query: string;
    let params: any[];

    if (userRole === 'Admin') {
      // Admin can see all projects
      query = `
        SELECT DISTINCT p.project_id, p.name, p.location, p.created_by, p.created_at, p.updated_at, p.created_by_user_id
        FROM projects p
        ORDER BY p.created_at DESC
      `;
      params = [];
    } else {
      // Other users can only see projects they're assigned to
      query = `
        SELECT DISTINCT p.project_id, p.name, p.location, p.created_by, p.created_at, p.updated_at, p.created_by_user_id
        FROM projects p
        INNER JOIN user_project_assignments upa ON p.project_id = upa.project_id
        WHERE $1 = ANY(upa.assignee)
        ORDER BY p.created_at DESC
      `;
      params = [userId];
    }

    const rows = await db.query<Project>(query, params);
    
    logger.info(`Retrieved ${rows.length} projects for user ${userId} with role ${userRole}`);
    
    return rows.map(row => ({
      ...row,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    }));
  } catch (error) {
    logger.error('Error retrieving projects by user from database:', error);
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
        updated_at,
        created_by_user_id
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
      `INSERT INTO projects (project_id, name, location, created_by, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING project_id, name, location, created_by, created_at, updated_at, created_by_user_id`,
      [projectId, projectData.name, projectData.location, projectData.created_by, projectData.created_by_user_id]
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