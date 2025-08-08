import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

export async function getPool(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  return await initializePool();
}

async function initializePool(): Promise<Pool> {
  // Close existing pool if it exists
  if (pool) {
    try {
      await pool.end();
    } catch (error) {
      logger.warn('Error closing existing pool', { error });
    }
    pool = null;
  }

  try {
    // Log database configuration (excluding password)
    logger.info('Database configuration:', {
      host: process.env.PGHOST,
      port: process.env.PGPORT,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      ssl: process.env.PGSSL,
    });

    const config: PoolConfig = {
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT || '5432'),
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: {
        rejectUnauthorized: false // Required for AWS RDS
      },
      max: 10, // Reduced for serverless environment
      min: 0, // Start with no connections
      idleTimeoutMillis: 60000, // Keep connections alive longer
      connectionTimeoutMillis: 10000, // Increased timeout for serverless cold starts
      // reapIntervalMillis: 1000, // Check for dead connections every second
    };

    pool = new Pool(config);

    // Handle pool errors
    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', { error: err });
      // Don't exit the process, just log the error
      // process.exit(-1);
    });

    // Test the connection with retry logic
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        const client = await pool.connect();
        client.release();
        logger.info('Successfully connected to database');
        return pool;
      } catch (error: any) {
        retries++;
        logger.error('Failed to connect to database', { error, retry: retries });
        
        if (retries >= maxRetries) {
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000 * retries));
      }
    }

    throw new Error('Failed to establish database connection after multiple retries');
  } catch (error) {
    logger.error('Failed to initialize database pool', { error });
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing pool');
  if (pool) {
    await pool.end();
  }
});

export async function query<T>(text: string, params: any[] = []): Promise<T[]> {
  const start = Date.now();
  let retries = 0;
  const maxRetries = 3;
  
  while (retries < maxRetries) {
    try {
      const dbPool = await getPool();
      const res = await dbPool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Executed query', { text, duration, rows: res.rowCount });
      return res.rows;
    } catch (error: any) {
      retries++;
      logger.error('Database query error', { error, text, retry: retries });
      
      // If it's a connection timeout and we haven't exhausted retries, try again
      if (retries < maxRetries && (
        error.code === 'ECONNRESET' || 
        error.code === 'ENOTFOUND' || 
        error.message?.includes('timeout') ||
        error.message?.includes('Connection terminated')
      )) {
        logger.info(`Retrying query (attempt ${retries}/${maxRetries})`);
        
        // Reset the pool on connection issues
        if (retries === 1) {
          logger.info('Resetting database pool due to connection issue');
          pool = null; // Force pool reinitialization
        }
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        continue;
      }
      
      throw error;
    }
  }
  
  throw new Error('Max retries exceeded for database query');
}

export async function transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const dbPool = await getPool();
  const client = await dbPool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Function to check if the pool is healthy
export async function checkPoolHealth(): Promise<boolean> {
  try {
    const dbPool = await getPool();
    const client = await dbPool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    logger.error('Pool health check failed', { error });
    return false;
  }
} 