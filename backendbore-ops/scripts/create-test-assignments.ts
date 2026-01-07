import * as db from '../src/db';
import { logger } from '../src/utils/logger';

async function createTestAssignments() {
  try {
    logger.info('Creating test borelog assignments...');

    // First, let's get some existing borelogs and users
    const borelogs = await db.query('SELECT borelog_id FROM boreloge LIMIT 3');
    const siteEngineers = await db.query("SELECT user_id FROM users WHERE role = 'Site Engineer' LIMIT 2");
    const admins = await db.query("SELECT user_id FROM users WHERE role = 'Admin' LIMIT 1");

    if (borelogs.length === 0) {
      logger.error('No borelogs found in database');
      return;
    }

    if (siteEngineers.length === 0) {
      logger.error('No site engineers found in database');
      return;
    }

    if (admins.length === 0) {
      logger.error('No admins found in database');
      return;
    }

    const adminId = admins[0].user_id;
    const siteEngineer1 = siteEngineers[0].user_id;
    const siteEngineer2 = siteEngineers.length > 1 ? siteEngineers[1].user_id : siteEngineers[0].user_id;

    // Create assignments for the first two borelogs
    const assignments = [
      {
        borelog_id: borelogs[0].borelog_id,
        assigned_site_engineer: siteEngineer1,
        assigned_by: adminId,
        notes: 'Test assignment for borelog 1',
        expected_completion_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      },
      {
        borelog_id: borelogs[1]?.borelog_id,
        assigned_site_engineer: siteEngineer2,
        assigned_by: adminId,
        notes: 'Test assignment for borelog 2',
        expected_completion_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days from now
      }
    ];

    for (const assignment of assignments) {
      if (!assignment.borelog_id) continue;

      // Check if assignment already exists
      const existingAssignment = await db.query(
        'SELECT assignment_id FROM borelog_assignments WHERE borelog_id = $1 AND status = $2',
        [assignment.borelog_id, 'active']
      );

      if (existingAssignment.length === 0) {
        // Create new assignment
        await db.query(
          `INSERT INTO borelog_assignments (
            borelog_id, assigned_site_engineer, assigned_by, notes, expected_completion_date, status
          )
          VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            assignment.borelog_id,
            assignment.assigned_site_engineer,
            assignment.assigned_by,
            assignment.notes,
            assignment.expected_completion_date,
            'active'
          ]
        );
        logger.info(`Created assignment for borelog ${assignment.borelog_id}`);
      } else {
        logger.info(`Assignment already exists for borelog ${assignment.borelog_id}`);
      }
    }

    logger.info('Test assignments created successfully');
  } catch (error) {
    logger.error('Error creating test assignments:', error);
    throw error;
  }
}

// Run the script
createTestAssignments()
  .then(() => {
    logger.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
