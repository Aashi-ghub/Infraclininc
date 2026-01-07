import * as db from '../db';
import { logger } from '../utils/logger';
import { UserRole } from '../utils/validateInput';

export interface UserAssignment {
  id: string;
  assignment_type: 'AdminToManager' | 'ManagerToTeam';
  project_id: string;
  assigner: string[];
  assignee: string[];
  created_at: Date;
  updated_at: Date;
  created_by_user_id?: string;
}

export interface UserProjectAccess {
  user_id: string;
  project_id: string;
  role: UserRole;
  can_edit: boolean;
  can_approve: boolean;
}

export const getUserAssignmentsByProject = async (projectId: string): Promise<UserAssignment[]> => {
  try {
    const rows = await db.query<UserAssignment>(
      `SELECT 
        id,
        assignment_type,
        project_id,
        assigner,
        assignee,
        created_at,
        updated_at,
        created_by_user_id
      FROM user_project_assignments
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
    logger.error('Error retrieving user assignments by project:', error);
    throw error;
  }
};

export const getUserAssignmentsByUser = async (userId: string): Promise<UserAssignment[]> => {
  try {
    const rows = await db.query<UserAssignment>(
      `SELECT 
        id,
        assignment_type,
        project_id,
        assigner,
        assignee,
        created_at,
        updated_at,
        created_by_user_id
      FROM user_project_assignments
      WHERE $1 = ANY(assignee)
      ORDER BY created_at DESC`,
      [userId]
    );
    
    return rows.map(row => ({
      ...row,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    }));
  } catch (error) {
    logger.error('Error retrieving user assignments by user:', error);
    throw error;
  }
};

export const createUserAssignment = async (
  assignmentData: Omit<UserAssignment, 'id' | 'created_at' | 'updated_at'>
): Promise<UserAssignment> => {
  try {
    const assignmentId = require('uuid').v4();
    const rows = await db.query<UserAssignment>(
      `INSERT INTO user_project_assignments (
        id, assignment_type, project_id, assigner, assignee, created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, assignment_type, project_id, assigner, assignee, created_at, updated_at, created_by_user_id`,
      [
        assignmentId,
        assignmentData.assignment_type,
        assignmentData.project_id,
        assignmentData.assigner,
        assignmentData.assignee,
        assignmentData.created_by_user_id
      ]
    );
    
    const row = rows[0];
    return {
      ...row,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  } catch (error) {
    logger.error('Error creating user assignment:', error);
    throw error;
  }
};

export const checkUserProjectAccess = async (
  userId: string,
  projectId: string,
  userRole: UserRole
): Promise<UserProjectAccess | null> => {
  try {
    // Get user assignments for this project
    const assignments = await getUserAssignmentsByUser(userId);
    const projectAssignment = assignments.find(a => a.project_id === projectId);
    
    if (!projectAssignment) {
      return null;
    }
    
    // Determine access based on role and assignment
    let can_edit = false;
    let can_approve = false;
    
    switch (userRole) {
      case 'Admin':
        can_edit = true;
        can_approve = true;
        break;
      case 'Project Manager':
        can_edit = true;
        can_approve = false;
        break;
      case 'Site Engineer':
        can_edit = true;
        can_approve = false;
        break;
      case 'Approval Engineer':
        can_edit = false;
        can_approve = true;
        break;
      case 'Lab Engineer':
        can_edit = false;
        can_approve = false;
        break;
      case 'Customer':
        can_edit = false;
        can_approve = false;
        break;
    }
    
    return {
      user_id: userId,
      project_id: projectId,
      role: userRole,
      can_edit,
      can_approve
    };
  } catch (error) {
    logger.error('Error checking user project access:', error);
    throw error;
  }
};

export const getUsersByProject = async (projectId: string): Promise<any[]> => {
  try {
    const rows = await db.query(
      `SELECT DISTINCT u.user_id, u.name, u.email, u.role
       FROM users u
       INNER JOIN user_project_assignments upa ON u.user_id = ANY(upa.assignee)
       WHERE upa.project_id = $1
       ORDER BY u.name`,
      [projectId]
    );
    
    return rows;
  } catch (error) {
    logger.error('Error retrieving users by project:', error);
    throw error;
  }
}; 