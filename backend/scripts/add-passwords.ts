import { query } from '../src/db';
import { logger } from '../src/utils/logger';

async function addPasswords() {
  try {
    logger.info('Adding password field to users table...');
    
    // Add password column to users table
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT');
    
    // Set default passwords for existing users (password: password123)
    const users = [
      'admin@acme.com',
      'pm@acme.com', 
      'engineer@acme.com',
      'approval@acme.com',
      'lab@acme.com',
      'customer@acme.com'
    ];
    
    for (const email of users) {
      await query(
        'UPDATE users SET password_hash = $1 WHERE email = $2',
        ['password123', email]
      );
      logger.info(`Set password for user: ${email}`);
    }
    
    logger.info('Successfully added passwords to all users');
    logger.info('All users now have password: password123');
    
  } catch (error) {
    logger.error('Error adding passwords:', error);
    throw error;
  }
}

// Run the script
addPasswords().catch((error) => {
  logger.error('Failed to add passwords:', error);
  process.exit(1);
}); 