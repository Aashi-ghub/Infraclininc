import { v4 as uuidv4 } from 'uuid';
import * as db from '../db';
import { logger } from '../utils/logger';

export interface Contact {
  contact_id: string;
  organisation_id: string;
  name: string;
  role: 'Admin' | 'Project Manager' | 'Site Engineer' | 'Supervisor' | 'QA/QC';
  date_created: string;
}

export interface CreateContactInput {
  organisation_id: string;
  name: string;
  role: 'Admin' | 'Project Manager' | 'Site Engineer' | 'Supervisor' | 'QA/QC';
}

export async function createOrganisationIfNotExists(organisationId: string, organisationName: string): Promise<void> {
  try {
    // Check if organisation exists
    const orgRows = await db.query<any>(
      'SELECT organisation_id FROM organisations WHERE organisation_id = $1',
      [organisationId]
    );

    if (orgRows.length === 0) {
      // Create a customer first (required for foreign key constraint)
      const customerId = uuidv4();
      await db.query(
        `INSERT INTO customers (customer_id, name)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [customerId, 'Auto-created Customer']
      );

      // Create the organisation
      await db.query(
        `INSERT INTO organisations (organisation_id, customer_id, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (organisation_id) DO UPDATE SET name = $3`,
        [organisationId, customerId, organisationName]
      );

      logger.info(`Created organisation: ${organisationName} with ID: ${organisationId}`);
    }
  } catch (error) {
    logger.error('Error creating organisation', { error, organisationId });
    throw error;
  }
}

export async function createContact(input: CreateContactInput): Promise<Contact> {
  const contactId = uuidv4();
  
  try {
    const rows = await db.query<Contact>(
      `INSERT INTO contacts (contact_id, organisation_id, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING contact_id, organisation_id, name, role, date_created`,
      [contactId, input.organisation_id, input.name, input.role]
    );

    return rows[0];
  } catch (error) {
    logger.error('Error creating contact', { error });
    throw error;
  }
}

export async function getAllContacts(): Promise<Contact[]> {
  try {
    const rows = await db.query<Contact>(
      `SELECT contact_id, organisation_id, name, role, date_created
       FROM contacts
       ORDER BY date_created DESC`
    );

    return rows;
  } catch (error) {
    logger.error('Error retrieving contacts', { error });
    throw error;
  }
}

export async function getContactById(contactId: string): Promise<Contact | null> {
  try {
    const rows = await db.query<Contact>(
      `SELECT contact_id, organisation_id, name, role, date_created
       FROM contacts
       WHERE contact_id = $1`,
      [contactId]
    );

    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error('Error retrieving contact by ID', { error, contactId });
    throw error;
  }
}

export async function getContactsByOrganisation(organisationId: string): Promise<Contact[]> {
  try {
    const rows = await db.query<Contact>(
      `SELECT contact_id, organisation_id, name, role, date_created
       FROM contacts
       WHERE organisation_id = $1
       ORDER BY date_created DESC`,
      [organisationId]
    );

    return rows;
  } catch (error) {
    logger.error('Error retrieving contacts by organisation', { error, organisationId });
    throw error;
  }
}

export async function updateContact(contactId: string, updates: Partial<CreateContactInput>): Promise<Contact | null> {
  try {
    // Build the SET clause dynamically based on provided updates
    const setClauses = [];
    const values = [contactId];
    let paramIndex = 2;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }

    if (updates.role !== undefined) {
      setClauses.push(`role = $${paramIndex++}`);
      values.push(updates.role);
    }

    if (updates.organisation_id !== undefined) {
      setClauses.push(`organisation_id = $${paramIndex++}`);
      values.push(updates.organisation_id);
    }

    // If no updates provided, return the current contact
    if (setClauses.length === 0) {
      return getContactById(contactId);
    }

    const rows = await db.query<Contact>(
      `UPDATE contacts
       SET ${setClauses.join(', ')}
       WHERE contact_id = $1
       RETURNING contact_id, organisation_id, name, role, date_created`,
      values
    );

    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error('Error updating contact', { error, contactId });
    throw error;
  }
}

export async function deleteContact(contactId: string): Promise<boolean> {
  try {
    const rows = await db.query<any>(
      'DELETE FROM contacts WHERE contact_id = $1 RETURNING contact_id',
      [contactId]
    );

    return rows.length > 0;
  } catch (error) {
    logger.error('Error deleting contact', { error, contactId });
    throw error;
  }
} 