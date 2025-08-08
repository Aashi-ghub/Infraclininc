import { logger } from '../src/utils/logger';
import { checkPoolHealth } from '../src/db';

async function checkEnvironment() {
  // Log environment variables (excluding sensitive data)
  logger.info('Environment variables:', {
    PGHOST: process.env.PGHOST,
    PGPORT: process.env.PGPORT,
    PGDATABASE: process.env.PGDATABASE,
    PGUSER: process.env.PGUSER,
    JWT_SECRET: process.env.JWT_SECRET ? '[SET]' : '[NOT SET]',
  });

  // Check database connection
  try {
    const isHealthy = await checkPoolHealth();
    if (isHealthy) {
      logger.info('Database connection successful');
    } else {
      logger.error('Database connection failed');
    }
  } catch (error) {
    logger.error('Error checking database connection:', error);
  }
}

checkEnvironment().catch(console.error);