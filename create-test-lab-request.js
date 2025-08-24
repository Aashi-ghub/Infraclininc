/**
 * Create a test lab request for testing the version control system
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Database configuration
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'backendbore',
  user: 'postgres',
  password: 'postgres'
});

async function createTestLabRequest() {
  try {
    console.log('🔧 Creating test lab request...');
    
    // First, check if we have any projects and borelogs
    const projectQuery = `
      SELECT project_id, name 
      FROM projects 
      LIMIT 1
    `;
    
    const projectResult = await pool.query(projectQuery);
    
    if (projectResult.rows.length === 0) {
      console.log('❌ No projects found. Please create a project first.');
      return null;
    }
    
    const project = projectResult.rows[0];
    console.log(`📋 Using project: ${project.name} (${project.project_id})`);
    
    // Get a borelog for this project
    const borelogQuery = `
      SELECT borelog_id, number 
      FROM borelog_details 
      WHERE borelog_id IN (
        SELECT borelog_id FROM boreloge WHERE project_id = $1
      )
      ORDER BY version_no DESC 
      LIMIT 1
    `;
    
    const borelogResult = await pool.query(borelogQuery, [project.project_id]);
    
    if (borelogResult.rows.length === 0) {
      console.log('❌ No borelogs found for this project. Please create a borelog first.');
      return null;
    }
    
    const borelog = borelogResult.rows[0];
    console.log(`🕳️ Using borelog: ${borelog.number || borelog.borelog_id}`);
    
    // Get a user to assign to
    const userQuery = `
      SELECT user_id, name, email 
      FROM users 
      WHERE role = 'Lab Engineer' 
      LIMIT 1
    `;
    
    const userResult = await pool.query(userQuery);
    
    if (userResult.rows.length === 0) {
      console.log('❌ No lab engineers found. Please create a user with Lab Engineer role first.');
      return null;
    }
    
    const user = userResult.rows[0];
    console.log(`👤 Using user: ${user.name} (${user.email})`);
    
    // Create lab request
    const assignmentId = uuidv4();
    const reportId = uuidv4();
    const sampleId = `BH-TEST-${Date.now()}`;
    
    console.log(`🆔 Generated Assignment ID: ${assignmentId}`);
    console.log(`📄 Generated Report ID: ${reportId}`);
    console.log(`🧪 Generated Sample ID: ${sampleId}`);
    
    // Insert lab test assignment
    const insertAssignmentQuery = `
      INSERT INTO lab_test_assignments (
        assignment_id, borelog_id, version_no, sample_ids, assigned_by, 
        assigned_to, due_date, priority, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const assignmentValues = [
      assignmentId,
      borelog.borelog_id,
      1,
      [sampleId],
      user.user_id,
      user.user_id,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      'normal',
      'Test lab request for version control testing'
    ];
    
    const assignmentResult = await pool.query(insertAssignmentQuery, assignmentValues);
    console.log('✅ Lab test assignment created successfully');
    
    // Insert unified lab report
    const insertReportQuery = `
      INSERT INTO unified_lab_reports (
        report_id, assignment_id, borelog_id, sample_id, project_name, borehole_no, 
        client, test_date, tested_by, checked_by, approved_by, test_types, 
        soil_test_data, rock_test_data, status, remarks, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `;
    
    const reportValues = [
      reportId,
      assignmentId,
      borelog.borelog_id,
      sampleId,
      project.name,
      borelog.number || 'N/A',
      'Test Client',
      new Date().toISOString(),
      'TBD',
      'TBD',
      'TBD',
      JSON.stringify(['Comprehensive Soil & Rock Tests']),
      JSON.stringify([]),
      JSON.stringify([]),
      'draft',
      'Test lab request for version control testing',
      user.user_id
    ];
    
    await pool.query(insertReportQuery, reportValues);
    console.log('✅ Unified lab report created successfully');
    
    // Insert initial version
    const insertVersionQuery = `
      INSERT INTO lab_report_versions (
        report_id, version_no, assignment_id, borelog_id, sample_id, project_name, borehole_no,
        client, test_date, tested_by, checked_by, approved_by, test_types, 
        soil_test_data, rock_test_data, status, remarks, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    `;
    
    const versionValues = [
      reportId,
      1,
      assignmentId,
      borelog.borelog_id,
      sampleId,
      project.name,
      borelog.number || 'N/A',
      'Test Client',
      new Date().toISOString(),
      'TBD',
      'TBD',
      'TBD',
      JSON.stringify(['Comprehensive Soil & Rock Tests']),
      JSON.stringify([]),
      JSON.stringify([]),
      'draft',
      'Test lab request for version control testing',
      user.user_id
    ];
    
    await pool.query(insertVersionQuery, versionValues);
    console.log('✅ Initial version created successfully');
    
    console.log('\n🎉 Test lab request created successfully!');
    console.log(`📋 Assignment ID: ${assignmentId}`);
    console.log(`📄 Report ID: ${reportId}`);
    console.log(`🧪 Sample ID: ${sampleId}`);
    console.log(`🔗 Test URL: /lab-reports/unified/${assignmentId}`);
    
    return {
      assignment_id: assignmentId,
      report_id: reportId,
      sample_id: sampleId
    };
    
  } catch (error) {
    console.error('❌ Error creating test lab request:', error);
    return null;
  } finally {
    await pool.end();
  }
}

// Run the function
createTestLabRequest();
