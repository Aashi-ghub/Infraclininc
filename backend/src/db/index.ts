import { Pool, PoolConfig } from 'pg';
import { APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../utils/logger';

/**
 * Database Disabled Mode
 * 
 * When DB_ENABLED is not "true", the database layer is completely disabled.
 * This is used during migration from PostgreSQL to S3 + Parquet.
 * 
 * - No database connections will be attempted
 * - All query/transaction calls will throw DbDisabledError
 * - The app will start normally without database dependency
 */
export const DB_ENABLED = process.env.DB_ENABLED === 'true';

/**
 * Custom error class for when database is disabled
 */
export class DbDisabledError extends Error {
  constructor(message: string = 'Database is disabled') {
    super(message);
    this.name = 'DbDisabledError';
  }
}

let pool: Pool | null = null;

// Log database status on module load
if (!DB_ENABLED) {
  logger.info('[DB DISABLED] Database layer is not initialized. Set DB_ENABLED=true to enable database connections.');
  console.log('[DB DISABLED] Database layer is not initialized. Set DB_ENABLED=true to enable database connections.');
}

export async function getPool(): Promise<Pool> {
  // Guard: Do not initialize pool if DB is disabled
  if (!DB_ENABLED) {
    logger.warn('[DB DISABLED] Attempted to get database pool when DB is disabled');
    throw new DbDisabledError('Database pool is not available - DB_ENABLED is not set to true');
  }

  if (pool) {
    return pool;
  }

  return await initializePool();
}

async function initializePool(): Promise<Pool> {
  // Guard: Do not initialize pool if DB is disabled
  if (!DB_ENABLED) {
    logger.warn('[DB DISABLED] Attempted to initialize database pool when DB is disabled');
    throw new DbDisabledError('Cannot initialize database pool - DB_ENABLED is not set to true');
  }

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
  // Guard: Do not execute queries if DB is disabled
  if (!DB_ENABLED) {
    logger.warn('[DB DISABLED] Attempted database query when DB is disabled', { query: text.substring(0, 100) });
    throw new DbDisabledError('Database queries are not available - DB_ENABLED is not set to true');
  }

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
  // Guard: Do not execute transactions if DB is disabled
  if (!DB_ENABLED) {
    logger.warn('[DB DISABLED] Attempted database transaction when DB is disabled');
    throw new DbDisabledError('Database transactions are not available - DB_ENABLED is not set to true');
  }

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
  // If DB is disabled, return false (pool is not healthy because it's not initialized)
  if (!DB_ENABLED) {
    logger.debug('[DB DISABLED] Pool health check - DB is disabled');
    return false;
  }

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

/**
 * Check if database is enabled
 * Utility function for handlers to check before attempting DB operations
 */
export function isDbEnabled(): boolean {
  return DB_ENABLED;
}

/**
 * Create a 503 response for when database is disabled
 * Use this at the top of handlers that require database access
 * 
 * @param routeName - Name of the route for logging purposes
 * @returns APIGatewayProxyResult with 503 status
 */
export function createDbDisabledResponse(routeName: string): APIGatewayProxyResult {
  logger.warn(`[DB DISABLED] Attempted access to DB-based route: ${routeName}`);
  console.log(`[DB DISABLED] Attempted access to DB-based route: ${routeName}`);
  
  return {
    statusCode: 503,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({
      success: false,
      message: 'This feature is temporarily unavailable',
      error: 'Database functionality is currently disabled during migration'
    })
  };
}

/**
 * Guard function for handlers that require database access
 * Returns null if DB is enabled, otherwise returns a 503 response
 * 
 * Usage in handlers:
 *   const dbGuard = guardDbRoute('listProjects');
 *   if (dbGuard) return dbGuard;
 * 
 * @param routeName - Name of the route for logging purposes
 * @returns null if DB is enabled, APIGatewayProxyResult if disabled
 */
export function guardDbRoute(routeName: string): APIGatewayProxyResult | null {
  if (DB_ENABLED) {
    return null;
  }
  return createDbDisabledResponse(routeName);
}

/**
 * Check if an error is a DbDisabledError
 * Use in catch blocks to return proper 503 response
 * 
 * Usage in handlers:
 *   catch (error) {
 *     if (isDbDisabledError(error)) {
 *       return createDbDisabledResponse('routeName');
 *     }
 *     // handle other errors...
 *   }
 */
export function isDbDisabledError(error: unknown): error is DbDisabledError {
  return error instanceof DbDisabledError;
}

/**
 * Handle error in catch block, returning 503 if it's a DbDisabledError
 * 
 * Usage in handlers:
 *   catch (error) {
 *     const dbErrorResponse = handleDbError(error, 'routeName');
 *     if (dbErrorResponse) return dbErrorResponse;
 *     // handle other errors...
 *   }
 */
export function handleDbError(error: unknown, routeName: string): APIGatewayProxyResult | null {
  if (isDbDisabledError(error)) {
    return createDbDisabledResponse(routeName);
  }
  return null;
}
