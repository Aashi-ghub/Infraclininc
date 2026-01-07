import { query } from '../src/db';
import { logger } from '../src/utils/logger';

interface TimeResult {
  now: Date;
}

interface TableResult {
  tablename: string;
}

interface ExistsResult {
  exists: boolean;
}

interface ForeignKeyResult {
  constraint_name: string;
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

async function checkDatabase() {
  try {
    logger.info('Connecting to database...');
    
    // Check connection
    const result = await query<TimeResult>('SELECT NOW()');
    logger.info('Database connection successful', { timestamp: result[0].now });
    
    // List all tables
    const tables = await query<TableResult>('SELECT tablename FROM pg_tables WHERE schemaname = $1', ['public']);
    logger.info('Tables in database:', { tables: tables.map(t => t.tablename) });
    
    // Check geological_log table
    const geologicalLogExists = await query<ExistsResult>('SELECT EXISTS(SELECT 1 FROM pg_tables WHERE tablename = $1 AND schemaname = $2) as exists', ['geological_log', 'public']);
    logger.info('geological_log table exists:', { exists: geologicalLogExists[0].exists });
    
    // Check boreloge table (the one referenced in the error)
    const borelogeExists = await query<ExistsResult>('SELECT EXISTS(SELECT 1 FROM pg_tables WHERE tablename = $1 AND schemaname = $2) as exists', ['boreloge', 'public']);
    logger.info('boreloge table exists:', { exists: borelogeExists[0].exists });
    
    // Check borelog_details table
    const borelogDetailsExists = await query<ExistsResult>('SELECT EXISTS(SELECT 1 FROM pg_tables WHERE tablename = $1 AND schemaname = $2) as exists', ['borelog_details', 'public']);
    logger.info('borelog_details table exists:', { exists: borelogDetailsExists[0].exists });
    
    // Check foreign keys on borelog_details
    if (borelogDetailsExists[0].exists) {
      const foreignKeys = await query<ForeignKeyResult>(`
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM
          information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='borelog_details';
      `);
      
      logger.info('Foreign keys on borelog_details:', { foreignKeys });
    }
    
  } catch (error) {
    logger.error('Error checking database', { error });
  } finally {
    process.exit(0);
  }
}

checkDatabase(); 