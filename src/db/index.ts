import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

export async function getPool(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  try {
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
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
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
  try {
    const dbPool = await getPool();
    const res = await dbPool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res.rows;
  } catch (error) {
    logger.error('Database query error', { error, text });
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