import * as db from '../db';
import { logger } from '../utils/logger';

export interface BorelogAssignment {
  assignment_id: string;
  borelog_id?: string;
  structure_id?: string;
  substructure_id?: string;
  assigned_site_engineer: string;
  assigned_by: string;
  assigned_at: Date;
  status: 'active' | 'inactive' | 'completed';
  notes?: string;
  expected_completion_date?: Date;
  completed_at?: Date;
}

export interface CreateBorelogAssignmentInput {
  borelog_id?: string;
  structure_id?: string;
  substructure_id?: string;
  assigned_site_engineer: string;
  assigned_by: string;
  notes?: string;
  expected_completion_date?: Date;
}

export interface UpdateBorelogAssignmentInput {
  status?: 'active' | 'inactive' | 'completed';
  notes?: string;
  expected_completion_date?: Date;
  completed_at?: Date;
}

export const createBorelogAssignment = async (
  assignmentData: CreateBorelogAssignmentInput
): Promise<BorelogAssignment> => {
  try {
    // Validate that at least one target is provided
    if (!assignmentData.borelog_id && !assignmentData.structure_id && !assignmentData.substructure_id) {
      throw new Error('At least one of borelog_id, structure_id, or substructure_id must be provided');
    }

    // Check if the site engineer exists and has the correct role
    const userQuery = `
      SELECT user_id, role FROM users 
      WHERE user_id = $1 AND role = 'Site Engineer'
    `;
    const userResult = await db.query(userQuery, [assignmentData.assigned_site_engineer]);
    
    if (userResult.length === 0) {
      throw new Error('User not found or is not a Site Engineer');
    }

    // Check for existing active assignment
    let existingAssignmentQuery = '';
    let existingAssignmentParams: any[] = [];

    if (assignmentData.borelog_id) {
      existingAssignmentQuery = `
        SELECT assignment_id FROM borelog_assignments 
        WHERE borelog_id = $1 AND assigned_site_engineer = $2 AND status = 'active'
      `;
      existingAssignmentParams = [assignmentData.borelog_id, assignmentData.assigned_site_engineer];
    } else if (assignmentData.structure_id) {
      existingAssignmentQuery = `
        SELECT assignment_id FROM borelog_assignments 
        WHERE structure_id = $1 AND assigned_site_engineer = $2 AND status = 'active'
      `;
      existingAssignmentParams = [assignmentData.structure_id, assignmentData.assigned_site_engineer];
    } else if (assignmentData.substructure_id) {
      existingAssignmentQuery = `
        SELECT assignment_id FROM borelog_assignments 
        WHERE substructure_id = $1 AND assigned_site_engineer = $2 AND status = 'active'
      `;
      existingAssignmentParams = [assignmentData.substructure_id, assignmentData.assigned_site_engineer];
    }

    if (existingAssignmentQuery) {
      const existingAssignment = await db.query(existingAssignmentQuery, existingAssignmentParams);
      if (existingAssignment.length > 0) {
        throw new Error('Site Engineer already has an active assignment for this target');
      }
    }

    // Create new assignment
    const insertQuery = `
      INSERT INTO borelog_assignments (
        borelog_id, structure_id, substructure_id, assigned_site_engineer, 
        assigned_by, notes, expected_completion_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await db.query<BorelogAssignment>(insertQuery, [
      assignmentData.borelog_id || null,
      assignmentData.structure_id || null,
      assignmentData.substructure_id || null,
      assignmentData.assigned_site_engineer,
      assignmentData.assigned_by,
      assignmentData.notes || null,
      assignmentData.expected_completion_date || null
    ]);

    const assignment = result[0];
    return {
      ...assignment,
      assigned_at: new Date(assignment.assigned_at),
      completed_at: assignment.completed_at ? new Date(assignment.completed_at) : undefined
    };
  } catch (error) {
    logger.error('Error creating borelog assignment:', error);
    throw error;
  }
};

export const updateBorelogAssignment = async (
  assignmentId: string,
  updateData: UpdateBorelogAssignmentInput
): Promise<BorelogAssignment> => {
  try {
    const updateFields: string[] = [];
    const updateParams: any[] = [];
    let paramIndex = 1;

    if (updateData.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      updateParams.push(updateData.status);
    }

    if (updateData.notes !== undefined) {
      updateFields.push(`notes = $${paramIndex++}`);
      updateParams.push(updateData.notes);
    }

    if (updateData.expected_completion_date !== undefined) {
      updateFields.push(`expected_completion_date = $${paramIndex++}`);
      updateParams.push(updateData.expected_completion_date);
    }

    if (updateData.completed_at !== undefined) {
      updateFields.push(`completed_at = $${paramIndex++}`);
      updateParams.push(updateData.completed_at);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateParams.push(assignmentId);

    const updateQuery = `
      UPDATE borelog_assignments 
      SET ${updateFields.join(', ')}
      WHERE assignment_id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query<BorelogAssignment>(updateQuery, updateParams);

    if (result.length === 0) {
      throw new Error('Assignment not found');
    }

    const assignment = result[0];
    return {
      ...assignment,
      assigned_at: new Date(assignment.assigned_at),
      completed_at: assignment.completed_at ? new Date(assignment.completed_at) : undefined
    };
  } catch (error) {
    logger.error('Error updating borelog assignment:', error);
    throw error;
  }
};

export const getBorelogAssignmentsByBorelogId = async (borelogId: string): Promise<BorelogAssignment[]> => {
  try {
    const query = `
      SELECT ba.*, u.name as assigned_site_engineer_name, u.email as assigned_site_engineer_email
      FROM borelog_assignments ba
      JOIN users u ON ba.assigned_site_engineer = u.user_id
      WHERE ba.borelog_id = $1
      ORDER BY ba.assigned_at DESC
    `;

    const result = await db.query<BorelogAssignment & { assigned_site_engineer_name: string; assigned_site_engineer_email: string }>(query, [borelogId]);

    return result.map(assignment => ({
      ...assignment,
      assigned_at: new Date(assignment.assigned_at),
      completed_at: assignment.completed_at ? new Date(assignment.completed_at) : undefined
    }));
  } catch (error) {
    logger.error('Error getting borelog assignments by borelog ID:', error);
    throw error;
  }
};

export const getBorelogAssignmentsByStructureId = async (structureId: string): Promise<BorelogAssignment[]> => {
  try {
    const query = `
      SELECT ba.*, u.name as assigned_site_engineer_name, u.email as assigned_site_engineer_email
      FROM borelog_assignments ba
      JOIN users u ON ba.assigned_site_engineer = u.user_id
      WHERE ba.structure_id = $1
      ORDER BY ba.assigned_at DESC
    `;

    const result = await db.query<BorelogAssignment & { assigned_site_engineer_name: string; assigned_site_engineer_email: string }>(query, [structureId]);

    return result.map(assignment => ({
      ...assignment,
      assigned_at: new Date(assignment.assigned_at),
      completed_at: assignment.completed_at ? new Date(assignment.completed_at) : undefined
    }));
  } catch (error) {
    logger.error('Error getting borelog assignments by structure ID:', error);
    throw error;
  }
};

export const getBorelogAssignmentsBySiteEngineer = async (siteEngineerId: string): Promise<BorelogAssignment[]> => {
  try {
    const query = `
      SELECT ba.*, 
             b.borelog_id, s.structure_id, ss.substructure_id,
             p.name as project_name,
             st.type as structure_type,
             sst.type as substructure_type
      FROM borelog_assignments ba
      LEFT JOIN boreloge b ON ba.borelog_id = b.borelog_id
      LEFT JOIN structure s ON ba.structure_id = s.structure_id
      LEFT JOIN sub_structures ss ON ba.substructure_id = ss.substructure_id
      LEFT JOIN projects p ON COALESCE(b.project_id, s.project_id, ss.project_id) = p.project_id
      LEFT JOIN structure st ON COALESCE(s.structure_id, ss.structure_id) = st.structure_id
      LEFT JOIN sub_structures sst ON ba.substructure_id = sst.substructure_id
      WHERE ba.assigned_site_engineer = $1
      ORDER BY ba.assigned_at DESC
    `;

    const result = await db.query<BorelogAssignment & { 
      project_name: string; 
      structure_type: string; 
      substructure_type: string;
    }>(query, [siteEngineerId]);

    return result.map(assignment => ({
      ...assignment,
      assigned_at: new Date(assignment.assigned_at),
      completed_at: assignment.completed_at ? new Date(assignment.completed_at) : undefined
    }));
  } catch (error) {
    logger.error('Error getting borelog assignments by site engineer:', error);
    throw error;
  }
};

export const getActiveBorelogAssignments = async (): Promise<BorelogAssignment[]> => {
  try {
    const query = `
      SELECT ba.*, 
             u.name as assigned_site_engineer_name, u.email as assigned_site_engineer_email,
             p.name as project_name,
             st.type as structure_type,
             sst.type as substructure_type
      FROM borelog_assignments ba
      JOIN users u ON ba.assigned_site_engineer = u.user_id
      LEFT JOIN boreloge b ON ba.borelog_id = b.borelog_id
      LEFT JOIN structure s ON ba.structure_id = s.structure_id
      LEFT JOIN sub_structures ss ON ba.substructure_id = ss.substructure_id
      LEFT JOIN projects p ON COALESCE(b.project_id, s.project_id, ss.project_id) = p.project_id
      LEFT JOIN structure st ON COALESCE(s.structure_id, ss.structure_id) = st.structure_id
      LEFT JOIN sub_structures sst ON ba.substructure_id = sst.substructure_id
      WHERE ba.status = 'active'
      ORDER BY ba.assigned_at DESC
    `;

    const result = await db.query<BorelogAssignment & { 
      assigned_site_engineer_name: string; 
      assigned_site_engineer_email: string;
      project_name: string; 
      structure_type: string; 
      substructure_type: string;
    }>(query);

    return result.map(assignment => ({
      ...assignment,
      assigned_at: new Date(assignment.assigned_at),
      completed_at: assignment.completed_at ? new Date(assignment.completed_at) : undefined
    }));
  } catch (error) {
    logger.error('Error getting active borelog assignments:', error);
    throw error;
  }
};

export const deleteBorelogAssignment = async (assignmentId: string): Promise<void> => {
  try {
    const deleteQuery = `
      DELETE FROM borelog_assignments 
      WHERE assignment_id = $1
    `;

    const result = await db.query(deleteQuery, [assignmentId]);

    if (result.length === 0) {
      throw new Error('Assignment not found');
    }
  } catch (error) {
    logger.error('Error deleting borelog assignment:', error);
    throw error;
  }
};
