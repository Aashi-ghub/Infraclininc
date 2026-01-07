import { query } from '../../src/db';
import { logger } from '../../src/utils/logger';

async function checkTableColumns(tableName: string): Promise<void> {
  try {
    const sql = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position;
    `;

    const columns = await query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(sql, [tableName]);

    logger.info(`Table: ${tableName} - ${columns.length} columns found`);
    
    columns.forEach(column => {
      logger.info(`  - ${column.column_name}: ${column.data_type} (${column.is_nullable === 'YES' ? 'nullable' : 'required'})`);
    });
  } catch (error) {
    logger.error(`Error checking table ${tableName}`, { error });
  }
}

async function checkForeignKeys(tableName: string): Promise<void> {
  try {
    const sql = `
      SELECT
        tc.constraint_name,
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
      WHERE
        tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = $1;
    `;

    const foreignKeys = await query<{
      constraint_name: string;
      column_name: string;
      foreign_table_name: string;
      foreign_column_name: string;
    }>(sql, [tableName]);

    logger.info(`Foreign keys for ${tableName}: ${foreignKeys.length} found`);
    
    foreignKeys.forEach(fk => {
      logger.info(`  - ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name} (${fk.constraint_name})`);
    });
  } catch (error) {
    logger.error(`Error checking foreign keys for ${tableName}`, { error });
  }
}

async function main() {
  try {
    logger.info('Starting database schema check');
    
    // Check tables relevant to our API
    await checkTableColumns('boreloge');
    await checkForeignKeys('boreloge');
    
    await checkTableColumns('borelog_details');
    await checkForeignKeys('borelog_details');
    
    await checkTableColumns('geological_log');
    await checkForeignKeys('geological_log');
    
    await checkTableColumns('sub_structures');
    await checkForeignKeys('sub_structures');
    
    await checkTableColumns('projects');
    await checkForeignKeys('projects');
    
    logger.info('Schema check completed');
  } catch (error) {
    logger.error('Error during schema check', { error });
  } finally {
    process.exit(0);
  }
}

main(); 