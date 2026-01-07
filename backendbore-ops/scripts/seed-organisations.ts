import * as db from '../src/db';
import { logger } from '../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Mock organizations that match the frontend
const organisations = [
  { id: '550e8400-e29b-41d4-a716-446655440000', name: 'ACME Corporation' },
  { id: '550e8400-e29b-41d4-a716-446655440001', name: 'Stark Industries' },
  { id: '550e8400-e29b-41d4-a716-446655440002', name: 'Wayne Enterprises' },
];

async function seedOrganisations() {
  try {
    logger.info('Starting to seed organisations table');
    
    // First create a customer (since organisations have a foreign key to customers)
    const customerId = uuidv4();
    await db.query(
      `INSERT INTO customers (customer_id, name) 
       VALUES ($1, $2) 
       ON CONFLICT (customer_id) DO NOTHING`,
      [customerId, 'Demo Customer']
    );
    
    logger.info('Created demo customer');
    
    // Insert each organisation
    for (const org of organisations) {
      await db.query(
        `INSERT INTO organisations (organisation_id, customer_id, name) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (organisation_id) DO UPDATE SET name = $3`,
        [org.id, customerId, org.name]
      );
      logger.info(`Created/updated organisation: ${org.name}`);
    }
    
    logger.info('Successfully seeded organisations table');
  } catch (error) {
    logger.error('Error seeding organisations table', { error });
    throw error;
  }
}

// Execute the function if this script is run directly
if (require.main === module) {
  seedOrganisations()
    .then(() => {
      logger.info('Seed script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seed script failed', { error });
      process.exit(1);
    });
}

export { seedOrganisations }; 