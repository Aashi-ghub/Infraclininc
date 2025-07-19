import { query } from '../db';
import { logger } from '../utils/logger';

export interface SubstructureAssignment {
  assignment_id: string;
  borelog_id: string;
  substructure_id: string;
  created_at: string;
  updated_at: string;
}

// Create the table if it doesn't exist
export async function ensureSubstructureAssignmentTable(): Promise<void> {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS substructure_assignments (
        assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        borelog_id UUID NOT NULL,
        substructure_id TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await query(sql, []);
    logger.info('Ensured substructure_assignments table exists');
  } catch (error) {
    logger.error('Error ensuring substructure_assignments table exists', { error });
    throw error;
  }
}

export async function getSubstructureAssignment(borelog_id: string): Promise<SubstructureAssignment | null> {
  try {
    const sql = `
      SELECT * FROM substructure_assignments
      WHERE borelog_id = $1
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    const result = await query<SubstructureAssignment>(sql, [borelog_id]);
    
    if (result.length === 0) {
      return null;
    }

    return result[0];
  } catch (error) {
    logger.error('Error getting substructure assignment', { error, borelog_id });
    throw error;
  }
}

export async function createOrUpdateSubstructureAssignment(
  borelog_id: string,
  substructure_id: string | null
): Promise<SubstructureAssignment | null> {
  try {
    // Ensure the table exists
    await ensureSubstructureAssignmentTable();

    if (!substructure_id) {
      // Delete the assignment if substructure_id is null
      const deleteSql = `
        DELETE FROM substructure_assignments
        WHERE borelog_id = $1
        RETURNING *;
      `;

      await query(deleteSql, [borelog_id]);
      return null;
    }

    // Check if an assignment already exists
    const existingAssignment = await getSubstructureAssignment(borelog_id);

    if (existingAssignment) {
      // Update existing assignment
      const updateSql = `
        UPDATE substructure_assignments
        SET substructure_id = $1, updated_at = NOW()
        WHERE assignment_id = $2
        RETURNING *;
      `;

      const result = await query<SubstructureAssignment>(updateSql, [substructure_id, existingAssignment.assignment_id]);
      return result[0];
    } else {
      // Create new assignment
      const insertSql = `
        INSERT INTO substructure_assignments (borelog_id, substructure_id)
        VALUES ($1, $2)
        RETURNING *;
      `;

      const result = await query<SubstructureAssignment>(insertSql, [borelog_id, substructure_id]);
      return result[0];
    }
  } catch (error) {
    logger.error('Error creating or updating substructure assignment', { error, borelog_id, substructure_id });
    throw error;
  }
}

export async function getAllSubstructureAssignments(): Promise<SubstructureAssignment[]> {
  try {
    // Ensure the table exists
    await ensureSubstructureAssignmentTable();

    const sql = `
      SELECT * FROM substructure_assignments
      ORDER BY updated_at DESC;
    `;

    return await query<SubstructureAssignment>(sql, []);
  } catch (error) {
    logger.error('Error getting all substructure assignments', { error });
    throw error;
  }
} 