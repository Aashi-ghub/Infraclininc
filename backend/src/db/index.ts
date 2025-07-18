import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger';

// Add dotenv config to ensure environment variables are loaded
import dotenv from 'dotenv';
dotenv.config();

let pool: Pool | null = null;

export async function getPool(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  try {
    // Log connection attempt
    logger.info('Attempting to connect to database', {
      host: process.env.PGHOST,
      port: process.env.PGPORT,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER
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
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Increase timeout to 10 seconds
    };

    pool = new Pool(config);

    // Handle pool errors
    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', { error: err });
      process.exit(-1);
    });

    // Test the connection
    const client = await pool.connect();
    client.release();
    logger.info('Successfully connected to database');

    return pool;
  } catch (error) {
    logger.error('Failed to initialize database pool', { 
      error,
      errorMessage: (error as Error).message,
      errorStack: (error as Error).stack,
      host: process.env.PGHOST,
      port: process.env.PGPORT,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER
    });
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
  try {
    const dbPool = await getPool();
    const res = await dbPool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res.rows;
  } catch (error) {
    logger.error('Database query error', { 
      error, 
      errorMessage: (error as Error).message,
      text 
    });
    throw error;
  }
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