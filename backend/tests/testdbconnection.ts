// testDbConnection.ts
import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

// Create a pg connection pool using .env
const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false } // RDS requires SSL
});

(async () => {
  try {
    // 🔁 Test query
    const result = await pool.query('SELECT NOW()');
    console.log('✅ DB Connected:', result.rows[0]);

    // 🔎 Query a table (optional)
    const borelogs = await pool.query('SELECT * FROM geological_log LIMIT 5');
    console.log('🔍 Sample Borelogs:', borelogs.rows);

    await pool.query(`
      INSERT INTO geological_log (
        borelog_id, project_name, client_name, created_by_user_id
      ) VALUES (
        gen_random_uuid(), 'Test Project', 'Test Client', NULL
      )
    `);
    console.log('✅ Inserted test geological log');
    

    // 🔒 Close the connection
    await pool.end();
  } catch (error) {
    console.error('❌ DB Connection Failed:', error);
  }
})();
