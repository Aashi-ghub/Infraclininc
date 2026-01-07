const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runPendingCSVMigration() {
  const pool = new Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    
    console.log('📖 Reading migration file...');
    const migrationPath = path.join(__dirname, 'migrations', 'create_pending_csv_uploads_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Running pending CSV uploads table migration...');
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the table was created
    console.log('🔍 Verifying migration...');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'pending_csv_uploads'
    `);
    
    if (result.rows.length === 1) {
      console.log('✅ pending_csv_uploads table created successfully');
      
      // Check the structure
      const structureResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'pending_csv_uploads'
        ORDER BY ordinal_position
      `);
      
      console.log('\n📋 Table structure:');
      structureResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
      });
      
    } else {
      console.log('❌ Table not found');
    }
    
    client.release();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
console.log('🔄 Starting pending CSV uploads table migration...\n');
runPendingCSVMigration();
