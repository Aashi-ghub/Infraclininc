import * as db from '../src/db';
import { logger } from '../src/utils/logger';

async function setupUnifiedLabReports() {
  try {
    logger.info('Setting up unified lab reports test data...');

    // 1. Create sample project
    const projectId = '550e8400-e29b-41d4-a716-446655441001';
    await createSampleProject(projectId);

    // 2. Create sample borelog
    const borelogId = '550e8400-e29b-41d4-a716-446655442001';
    await createSampleBorelog(borelogId, projectId);

    // 3. Create lab assignment
    const assignmentId = '550e8400-e29b-41d4-a716-446655444001';
    await createLabAssignment(assignmentId, borelogId);

    // 4. Create sample unified report
    const reportId = '550e8400-e29b-41d4-a716-446655447001';
    await createSampleUnifiedReport(reportId, assignmentId, borelogId);

    logger.info('✅ Unified lab reports test data setup completed successfully!');
  } catch (error) {
    logger.error('❌ Error setting up unified lab reports test data:', error);
    throw error;
  }
}

async function createSampleProject(projectId: string) {
  try {
    // Check if project already exists
    const existingProject = await db.query(
      'SELECT project_id FROM projects WHERE project_id = $1',
      [projectId]
    );

    if (existingProject.length === 0) {
      await db.query(
        `INSERT INTO projects (project_id, name, location, created_by_user_id)
         VALUES ($1, $2, $3, $4)`,
        [projectId, 'Highway Bridge Project - Phase 2', 'Melbourne, VIC', '550e8400-e29b-41d4-a716-446655440001']
      );
      logger.info('✅ Created sample project: Highway Bridge Project - Phase 2');
    } else {
      logger.info('ℹ️ Sample project already exists');
    }
  } catch (error) {
    logger.error('Error creating sample project:', error);
    throw error;
  }
}

async function createSampleBorelog(borelogId: string, projectId: string) {
  try {
    // Check if borelog already exists
    const existingBorelog = await db.query(
      'SELECT borelog_id FROM boreloge WHERE borelog_id = $1',
      [borelogId]
    );

    if (existingBorelog.length === 0) {
      // Create borelog
      await db.query(
        `INSERT INTO boreloge (borelog_id, substructure_id, project_id, type)
         VALUES ($1, $2, $3, $4)`,
        [borelogId, '550e8400-e29b-41d4-a716-446655443001', projectId, 'Geotechnical']
      );

      // Create borelog details
      await db.query(
        `INSERT INTO borelog_details (borelog_id, number, msl, boring_method, hole_diameter)
         VALUES ($1, $2, $3, $4, $5)`,
        [borelogId, 'BH-004', '100.5', 'Rotary Drilling', 150]
      );

      logger.info('✅ Created sample borelog: BH-004');
    } else {
      logger.info('ℹ️ Sample borelog already exists');
    }
  } catch (error) {
    logger.error('Error creating sample borelog:', error);
    throw error;
  }
}

async function createLabAssignment(assignmentId: string, borelogId: string) {
  try {
    // Check if assignment already exists
    const existingAssignment = await db.query(
      'SELECT assignment_id FROM lab_test_assignments WHERE assignment_id = $1',
      [assignmentId]
    );

    if (existingAssignment.length === 0) {
      await db.query(
        `INSERT INTO lab_test_assignments (
          assignment_id, borelog_id, assigned_to, assigned_by,
          test_types, due_date, priority, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          assignmentId,
          borelogId,
          '550e8400-e29b-41d4-a716-446655445001', // Lab Engineer
          '550e8400-e29b-41d4-a716-446655446001', // Project Manager
          JSON.stringify(['Soil', 'Rock']),
          '2024-02-15',
          'High',
          'Comprehensive soil and rock testing required for foundation design'
        ]
      );
      logger.info('✅ Created lab assignment');
    } else {
      logger.info('ℹ️ Lab assignment already exists');
    }
  } catch (error) {
    logger.error('Error creating lab assignment:', error);
    throw error;
  }
}

async function createSampleUnifiedReport(reportId: string, assignmentId: string, borelogId: string) {
  try {
    // Check if report already exists
    const existingReport = await db.query(
      'SELECT report_id FROM unified_lab_reports WHERE report_id = $1',
      [reportId]
    );

    if (existingReport.length === 0) {
      const soilTestData = [
        {
          test_type: "Moisture Content",
          sample_id: "S1",
          depth_m: 2.5,
          result_percent: 15.2,
          method: "ASTM D2216"
        },
        {
          test_type: "Atterberg Limits",
          sample_id: "S1",
          depth_m: 2.5,
          liquid_limit: 45,
          plastic_limit: 25,
          plasticity_index: 20
        },
        {
          test_type: "Density Test",
          sample_id: "S2",
          depth_m: 5.0,
          bulk_density_g_cm3: 2.45,
          dry_density_g_cm3: 2.32,
          void_ratio: 0.65
        }
      ];

      const rockTestData = [
        {
          test_type: "Unconfined Compressive Strength",
          sample_id: "R1",
          depth_m: 8.0,
          result_mpa: 45.2,
          sample_diameter_mm: 54,
          sample_height_mm: 108,
          failure_mode: "Axial splitting"
        },
        {
          test_type: "Point Load Test",
          sample_id: "R2",
          depth_m: 10.0,
          point_load_index_mpa: 3.2,
          equivalent_ucs_mpa: 48.0,
          sample_size: "Core"
        },
        {
          test_type: "Brazilian Test",
          sample_id: "R3",
          depth_m: 12.0,
          tensile_strength_mpa: 4.8,
          sample_diameter_mm: 54,
          sample_thickness_mm: 27
        }
      ];

      await db.query(
        `INSERT INTO unified_lab_reports (
          report_id, assignment_id, borelog_id, sample_id,
          project_name, borehole_no, client, test_date,
          tested_by, checked_by, approved_by, test_types,
          soil_test_data, rock_test_data, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          reportId,
          assignmentId,
          borelogId,
          'BH-004',
          'Highway Bridge Project - Phase 2',
          'BH-004',
          'Transport Authority',
          '2024-01-27',
          'Dr. Michael Chen',
          'Dr. Sarah Johnson',
          'Prof. David Wilson',
          JSON.stringify(['Soil', 'Rock']),
          JSON.stringify(soilTestData),
          JSON.stringify(rockTestData),
          'draft'
        ]
      );
      logger.info('✅ Created sample unified lab report');
    } else {
      logger.info('ℹ️ Sample unified lab report already exists');
    }
  } catch (error) {
    logger.error('Error creating sample unified report:', error);
    throw error;
  }
}

async function verifySetup() {
  try {
    logger.info('Verifying unified lab reports setup...');

    // Check unified lab reports
    const reports = await db.query('SELECT COUNT(*) as count FROM unified_lab_reports');
    logger.info(`📊 Unified lab reports: ${reports[0].count}`);

    // Check lab assignments
    const assignments = await db.query('SELECT COUNT(*) as count FROM lab_test_assignments');
    logger.info(`📊 Lab assignments: ${assignments[0].count}`);

    // Check the view
    const viewData = await db.query('SELECT COUNT(*) as count FROM unified_lab_reports_view');
    logger.info(`📊 View records: ${viewData[0].count}`);

    logger.info('✅ Setup verification completed');
  } catch (error) {
    logger.error('Error verifying setup:', error);
    throw error;
  }
}

// Run the setup
if (require.main === module) {
  setupUnifiedLabReports()
    .then(() => verifySetup())
    .then(() => {
      logger.info('🎉 Unified lab reports setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

export { setupUnifiedLabReports, verifySetup };
