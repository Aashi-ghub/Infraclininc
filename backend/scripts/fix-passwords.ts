import * as db from '../src/db';
import bcrypt from 'bcryptjs';

interface User {
  user_id: string;
  email: string;
  role: string;
  name: string;
}

async function fixUserPasswords() {
  try {
    console.log('Starting password fix...');
    
    // Get all users
    const users = await db.query('SELECT user_id, email, role, name FROM users') as User[];
    console.log(`Found ${users.length} users to update`);
    
    // Set passwords based on role
    for (const user of users) {
      let password = 'password123'; // Default password
      
      // Set role-specific passwords
      switch (user.role) {
        case 'Admin':
          password = 'admin123';
          break;
        case 'Project Manager':
          password = 'pm123';
          break;
        case 'Site Engineer':
          password = 'site123';
          break;
        case 'Approval Engineer':
          password = 'approval123';
          break;
        case 'Lab Engineer':
          password = 'lab123';
          break;
        case 'Customer':
          password = 'customer123';
          break;
        default:
          password = 'password123';
      }
      
      // Generate hash
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // Update user
      await db.query(
        'UPDATE users SET password_hash = $1 WHERE user_id = $2',
        [hashedPassword, user.user_id]
      );
      
      console.log(`✓ Updated ${user.name} (${user.email}) - Role: ${user.role} - Password: ${password}`);
    }
    
    console.log('\n✅ Password update completed!');
    console.log('\nLogin credentials:');
    console.log('=====================================');
    users.forEach(user => {
      let password = 'password123';
      switch (user.role) {
        case 'Admin': password = 'admin123'; break;
        case 'Project Manager': password = 'pm123'; break;
        case 'Site Engineer': password = 'site123'; break;
        case 'Approval Engineer': password = 'approval123'; break;
        case 'Lab Engineer': password = 'lab123'; break;
        case 'Customer': password = 'customer123'; break;
      }
      console.log(`${user.role}: ${user.email} / ${password}`);
    });
    console.log('=====================================');
    
  } catch (error) {
    console.error('Error fixing passwords:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

fixUserPasswords(); 