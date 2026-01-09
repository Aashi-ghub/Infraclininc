import { APIGatewayProxyEvent } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { 
  createContact, 
  getAllContacts, 
  getContactById, 
  getContactsByOrganisation,
  updateContact,
  deleteContact,
  CreateContactInput,
  createOrganisationIfNotExists,
  Contact
} from '../models/contacts';
import { createResponse } from '../types/common';
import { logger, logRequest, logResponse } from '../utils/logger';
import { validateInput } from '../utils/validateInput';
import { parseBody } from '../utils/parseBody';
import { z } from 'zod';
import { createStorageClient } from '../storage/s3Client';

// Schema for contact creation
const contactSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  role: z.enum(['Admin', 'Project Manager', 'Site Engineer', 'Supervisor', 'QA/QC']),
  organisation_id: z.string().uuid({ message: 'Valid organisation ID is required' })
});

// Create Contact Handler
export const createContactHandler = async (event: APIGatewayProxyEvent) => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Parse and validate request body
    if (!event.body) {
      const response = createResponse(400, {
        success: false,
        message: 'Request body is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const body = parseBody(event);
    if (!body) {
      return createResponse(400, { success: false, message: "Invalid JSON body" });
    }
    
    // Validate input against schema
    const validationResult = validateInput(body, contactSchema);
    if (!validationResult.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid input',
        errors: validationResult.error
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Create contact in S3
    const storageClient = createStorageClient();
    const contactsKey = 'config/contacts.json';
    
    // Read existing contacts
    let contacts: Contact[] = [];
    if (await storageClient.fileExists(contactsKey)) {
      try {
        const buffer = await storageClient.downloadFile(contactsKey);
        const parsed = JSON.parse(buffer.toString('utf-8'));
        contacts = Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        logger.warn('Error reading contacts.json, starting with empty array', { error });
        contacts = [];
      }
    }

    // Create new contact
    const contactId = uuidv4();
    const newContact: Contact = {
      contact_id: contactId,
      organisation_id: body.organisation_id,
      name: body.name,
      role: body.role,
      date_created: new Date().toISOString()
    };

    // Add to array
    contacts.push(newContact);

    // Write back to S3
    const contactsJson = JSON.stringify(contacts, null, 2);
    await storageClient.uploadFile(
      contactsKey,
      Buffer.from(contactsJson, 'utf-8'),
      'application/json'
    );

    logger.info('Contact created successfully', { contactId, name: body.name });

    const response = createResponse(201, {
      success: true,
      message: 'Contact created successfully',
      data: newContact
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error creating contact', { error });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create contact'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// List Contacts Handler
export const listContactsHandler = async (event: APIGatewayProxyEvent) => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    const storageClient = createStorageClient();
    const contactsKey = 'config/contacts.json';
    
    let contacts: any[] = [];
    
    // Read contacts from S3
    if (await storageClient.fileExists(contactsKey)) {
      try {
        const buffer = await storageClient.downloadFile(contactsKey);
        const parsed = JSON.parse(buffer.toString('utf-8'));
        // Ensure it's an array
        contacts = Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        logger.warn('Error reading contacts.json, returning empty array', { error });
        contacts = [];
      }
    } else {
      // File doesn't exist, return empty array (don't throw)
      logger.debug('contacts.json not found, returning empty array');
      contacts = [];
    }

    // Sort by date_created descending (latest first)
    contacts.sort((a, b) => {
      const dateA = a.date_created ? new Date(a.date_created).getTime() : 0;
      const dateB = b.date_created ? new Date(b.date_created).getTime() : 0;
      return dateB - dateA;
    });

    const response = createResponse(200, {
      success: true,
      message: 'Contacts retrieved successfully',
      data: contacts
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error retrieving contacts', { error });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve contacts'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Get Contact by ID Handler
export const getContactByIdHandler = async (event: APIGatewayProxyEvent) => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    const contactId = event.pathParameters?.contact_id;
    
    if (!contactId) {
      const response = createResponse(400, {
        success: false,
        message: 'Contact ID is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const contact = await getContactById(contactId);

    if (!contact) {
      const response = createResponse(404, {
        success: false,
        message: 'Contact not found'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const response = createResponse(200, {
      success: true,
      message: 'Contact retrieved successfully',
      data: contact
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error retrieving contact', { error });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve contact'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Get Contacts by Organisation Handler
export const getContactsByOrganisationHandler = async (event: APIGatewayProxyEvent) => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    const organisationId = event.pathParameters?.organisation_id;
    
    if (!organisationId) {
      const response = createResponse(400, {
        success: false,
        message: 'Organisation ID is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const contacts = await getContactsByOrganisation(organisationId);

    const response = createResponse(200, {
      success: true,
      message: 'Contacts retrieved successfully',
      data: contacts
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error retrieving contacts by organisation', { error });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve contacts'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Update Contact Handler
export const updateContactHandler = async (event: APIGatewayProxyEvent) => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    const contactId = event.pathParameters?.contact_id;
    
    if (!contactId) {
      const response = createResponse(400, {
        success: false,
        message: 'Contact ID is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Check if contact exists
    const existingContact = await getContactById(contactId);
    if (!existingContact) {
      const response = createResponse(404, {
        success: false,
        message: 'Contact not found'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Parse and validate request body
    if (!event.body) {
      const response = createResponse(400, {
        success: false,
        message: 'Request body is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const body = parseBody(event);
    if (!body) {
      return createResponse(400, { success: false, message: "Invalid JSON body" });
    }
    
    // Validate input (partial schema)
    const updateSchema = contactSchema.partial();
    const validationResult = validateInput(body, updateSchema);
    if (!validationResult.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid input',
        errors: validationResult.error
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // If organisation_id is being updated, ensure it exists
    if (body.organisation_id) {
      try {
        await createOrganisationIfNotExists(body.organisation_id, body.organisation_name || 'Default Organisation');
      } catch (error) {
        logger.warn('Failed to create organisation, proceeding anyway', { error });
      }
    }

    // Update contact
    const updates: Partial<CreateContactInput> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.role !== undefined) updates.role = body.role;
    if (body.organisation_id !== undefined) updates.organisation_id = body.organisation_id;

    const updatedContact = await updateContact(contactId, updates);

    const response = createResponse(200, {
      success: true,
      message: 'Contact updated successfully',
      data: updatedContact
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error updating contact', { error });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to update contact'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Delete Contact Handler
export const deleteContactHandler = async (event: APIGatewayProxyEvent) => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    const contactId = event.pathParameters?.contact_id;
    
    if (!contactId) {
      const response = createResponse(400, {
        success: false,
        message: 'Contact ID is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const deleted = await deleteContact(contactId);

    if (!deleted) {
      const response = createResponse(404, {
        success: false,
        message: 'Contact not found or already deleted'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const response = createResponse(200, {
      success: true,
      message: 'Contact deleted successfully'
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error deleting contact', { error });
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to delete contact'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 
