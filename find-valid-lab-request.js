/**
 * Find valid lab request IDs in the database
 */

const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'backendbore',
  user: 'postgres',
  password: 'postgres'
});

async function findValidLabRequests() {
  try {
    console.log('🔍 Finding valid lab requests in database...');
    
    // Get all lab requests
    const query = `
      SELECT 
        assignment_id,
        borelog_id,
        sample_ids,
        assigned_at,
        assigned_by,
        priority
      FROM lab_test_assignments 
      ORDER BY assigned_at DESC 
      LIMIT 10
    `;
    
    const result = await pool.query(query);
    console.log(`📊 Found ${result.rows.length} lab requests:`);
    
    if (result.rows.length === 0) {
      console.log('❌ No lab requests found in database');
      console.log('💡 You need to create a lab request first');
      return [];
    }
    
    result.rows.forEach((row, index) => {
      console.log(`\n${index + 1}. Assignment ID: ${row.assignment_id}`);
      console.log(`   Borelog ID: ${row.borelog_id}`);
      console.log(`   Sample IDs: ${JSON.stringify(row.sample_ids)}`);
      console.log(`   Assigned At: ${row.assigned_at}`);
      console.log(`   Priority: ${row.priority}`);
      console.log(`   🔗 Test URL: /lab-reports/unified/${row.assignment_id}`);
    });
    
    return result.rows;
    
  } catch (error) {
    console.error('❌ Error finding lab requests:', error);
    return [];
  } finally {
    await pool.end();
  }
}

// Also check if there are any unified lab reports
async function findUnifiedLabReports() {
  try {
    console.log('\n🔍 Finding unified lab reports...');
    
    const query = `
      SELECT 
        report_id,
        assignment_id,
        sample_id,
        status,
        created_at
      FROM unified_lab_reports 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    
    const result = await pool.query(query);
    console.log(`📊 Found ${result.rows.length} unified lab reports:`);
    
    result.rows.forEach((row, index) => {
      console.log(`\n${index + 1}. Report ID: ${row.report_id}`);
      console.log(`   Assignment ID: ${row.assignment_id}`);
      console.log(`   Sample ID: ${row.sample_id}`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Created At: ${row.created_at}`);
    });
    
    return result.rows;
    
  } catch (error) {
    console.error('❌ Error finding unified lab reports:', error);
    return [];
  }
}

// Main function
async function main() {
  console.log('🚀 Lab Request Finder');
  console.log('====================\n');
  
  const labRequests = await findValidLabRequests();
  const unifiedReports = await findUnifiedLabReports();
  
  if (labRequests.length > 0) {
    console.log('\n✅ Valid lab request IDs found!');
    console.log('🎯 You can use any of the assignment IDs above to test the version control system.');
    console.log('📝 Example: Use the first assignment ID to test the lab report form.');
  } else {
    console.log('\n❌ No lab requests found. You need to create one first.');
    console.log('💡 You can create a lab request through the admin interface or API.');
  }
}

main().catch(console.error);
