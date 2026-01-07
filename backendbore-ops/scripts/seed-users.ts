import * as db from '../src/db';
import { logger } from '../src/utils/logger';

interface SeedUser {
  user_id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Project Manager' | 'Site Engineer' | 'Approval Engineer' | 'Lab Engineer' | 'Customer';
  organisation_id?: string;
  customer_id?: string;
}

const seedUsers: SeedUser[] = [
  {
    user_id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'Admin'
  },
  {
    user_id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Project Manager',
    email: 'pm@example.com',
    role: 'Project Manager'
  },
  {
    user_id: '550e8400-e29b-41d4-a716-446655440003',
    name: 'Site Engineer',
    email: 'site@example.com',
    role: 'Site Engineer'
  },
  {
    user_id: '550e8400-e29b-41d4-a716-446655440004',
    name: 'Approval Engineer',
    email: 'approval@example.com',
    role: 'Approval Engineer'
  },
  {
    user_id: '550e8400-e29b-41d4-a716-446655440005',
    name: 'Lab Engineer',
    email: 'lab@example.com',
    role: 'Lab Engineer'
  },
  {
    user_id: '550e8400-e29b-41d4-a716-446655440006',
    name: 'Customer User',
    email: 'customer@example.com',
    role: 'Customer'
  }
];

async function seedUsersTable() {
  try {
    logger.info('Starting user seeding...');

    for (const user of seedUsers) {
      // Check if user already exists
      const existingUser = await db.query(
        'SELECT user_id FROM users WHERE user_id = $1',
        [user.user_id]
      );

      if (existingUser.length === 0) {
        // Insert new user
        await db.query(
          `INSERT INTO users (user_id, name, email, role, organisation_id, customer_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [user.user_id, user.name, user.email, user.role, user.organisation_id, user.customer_id]
        );
        logger.info(`Created user: ${user.name} (${user.email})`);
      } else {
        logger.info(`User already exists: ${user.name} (${user.email})`);
      }
    }

    logger.info('User seeding completed successfully');
  } catch (error) {
    logger.error('Error seeding users:', error);
    throw error;
  }
}

async function createSampleProject() {
  try {
    logger.info('Creating sample project...');

    const projectId = '550e8400-e29b-41d4-a716-446655441001';
    
    // Check if project already exists
    const existingProject = await db.query(
      'SELECT project_id FROM projects WHERE project_id = $1',
      [projectId]
    );

    if (existingProject.length === 0) {
      // Create sample project
      await db.query(
        `INSERT INTO projects (project_id, name, location, created_by_user_id)
         VALUES ($1, $2, $3, $4)`,
        [projectId, 'Sample Railway Project', 'Melbourne, VIC', '550e8400-e29b-41d4-a716-446655440001']
      );
      logger.info('Created sample project: Sample Railway Project');
    } else {
      logger.info('Sample project already exists');
    }

    return projectId;
  } catch (error) {
    logger.error('Error creating sample project:', error);
    throw error;
  }
}

async function createSampleAssignments(projectId: string) {
  try {
    logger.info('Creating sample user assignments...');

    const assignments = [
      {
        assignment_type: 'AdminToManager' as const,
        project_id: projectId,
        assigner: ['550e8400-e29b-41d4-a716-446655440001'], // Admin
        assignee: ['550e8400-e29b-41d4-a716-446655440002']  // Project Manager
      },
      {
        assignment_type: 'ManagerToTeam' as const,
        project_id: projectId,
        assigner: ['550e8400-e29b-41d4-a716-446655440002'], // Project Manager
        assignee: [
          '550e8400-e29b-41d4-a716-446655440003', // Site Engineer
          '550e8400-e29b-41d4-a716-446655440004', // Approval Engineer
          '550e8400-e29b-41d4-a716-446655440005'  // Lab Engineer
        ]
      }
    ];

    for (const assignment of assignments) {
      // Check if assignment already exists
      const existingAssignment = await db.query(
        'SELECT id FROM user_project_assignments WHERE project_id = $1 AND assignment_type = $2',
        [assignment.project_id, assignment.assignment_type]
      );

      if (existingAssignment.length === 0) {
        // Create assignment
        await db.query(
          `INSERT INTO user_project_assignments (assignment_type, project_id, assigner, assignee, created_by_user_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            assignment.assignment_type,
            assignment.project_id,
            assignment.assigner,
            assignment.assignee,
            '550e8400-e29b-41d4-a716-446655440001' // Created by Admin
          ]
        );
        logger.info(`Created assignment: ${assignment.assignment_type}`);
      } else {
        logger.info(`Assignment already exists: ${assignment.assignment_type}`);
      }
    }

    logger.info('Sample assignments created successfully');
  } catch (error) {
    logger.error('Error creating sample assignments:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedUsersTable();
    const projectId = await createSampleProject();
    await createSampleAssignments(projectId);
    
    logger.info('Database seeding completed successfully!');
    logger.info('Sample users created:');
    seedUsers.forEach(user => {
      logger.info(`  - ${user.name} (${user.email}) - ${user.role}`);
    });
    logger.info('Sample project created: Sample Railway Project');
    logger.info('Sample assignments created for the project');
  } catch (error) {
    logger.error('Database seeding failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  main();
} 