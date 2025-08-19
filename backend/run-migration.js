const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
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
    console.log('Connecting to database...');
    const client = await pool.connect();
    
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, 'migrations', 'create_stratum_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running migration...');
    await client.query(migrationSQL);
    
    console.log('Migration completed successfully!');
    
    // Verify the tables were created
    console.log('Verifying migration...');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('stratum_layers', 'stratum_sample_points')
    `);
    
    if (result.rows.length === 2) {
      console.log('✅ Both stratum_layers and stratum_sample_points tables created successfully');
    } else {
      console.log('❌ Tables not found:', result.rows.map(r => r.table_name));
    }
    
    client.release();
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
