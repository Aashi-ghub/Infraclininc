import * as db from '../src/db';
import bcrypt from 'bcryptjs';

interface User {
  user_id: string;
  email: string;
  role: string;
}

async function addPasswordHashColumn() {
  try {
    console.log('Starting password_hash column migration...');
    
    // Check if password_hash column already exists
    const columnCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'password_hash'
    `);
    
    if (columnCheck.length > 0) {
      console.log('password_hash column already exists. Skipping migration.');
      return;
    }
    
    // Add password_hash column
    await db.query('ALTER TABLE users ADD COLUMN password_hash TEXT');
    console.log('✓ Added password_hash column to users table');
    
    // Create indexes for better performance
    await db.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id)');
    console.log('✓ Created indexes for users table');
    
    // Get existing users
    const existingUsers = await db.query('SELECT user_id, email, role FROM users') as User[];
    console.log(`Found ${existingUsers.length} existing users to update`);
    
    // Update existing users with default passwords based on their role
    for (const user of existingUsers) {
      let defaultPassword = 'password123'; // Default password
      
      // Set role-specific default passwords
      switch (user.role) {
        case 'Admin':
          defaultPassword = 'admin123';
          break;
        case 'Project Manager':
          defaultPassword = 'pm123';
          break;
        case 'Site Engineer':
          defaultPassword = 'site123';
          break;
        case 'Approval Engineer':
          defaultPassword = 'approval123';
          break;
        case 'Lab Engineer':
          defaultPassword = 'lab123';
          break;
        case 'Customer':
          defaultPassword = 'customer123';
          break;
        default:
          defaultPassword = 'password123';
      }
      
      // Hash the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);
      
      // Update user with hashed password
      await db.query(
        'UPDATE users SET password_hash = $1 WHERE user_id = $2',
        [hashedPassword, user.user_id]
      );
      
      console.log(`✓ Updated user: ${user.email} (${user.role}) - Default password: ${defaultPassword}`);
    }
    
    console.log('\n✅ Password hash migration completed successfully!');
    console.log('\nDefault login credentials for existing users:');
    console.log('=====================================');
    existingUsers.forEach(user => {
      let defaultPassword = 'password123';
      switch (user.role) {
        case 'Admin': defaultPassword = 'admin123'; break;
        case 'Project Manager': defaultPassword = 'pm123'; break;
        case 'Site Engineer': defaultPassword = 'site123'; break;
        case 'Approval Engineer': defaultPassword = 'approval123'; break;
        case 'Lab Engineer': defaultPassword = 'lab123'; break;
        case 'Customer': defaultPassword = 'customer123'; break;
      }
      console.log(`${user.role}: ${user.email} / ${defaultPassword}`);
    });
    console.log('=====================================');
    console.log('\n⚠️  IMPORTANT: Change these passwords in production!');
    
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  } finally {
    // Note: db.end() is not available in this db module
    process.exit(0);
  }
}

addPasswordHashColumn(); 