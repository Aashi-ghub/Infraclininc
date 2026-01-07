import * as db from '../src/db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

interface SeedUser {
  user_id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Project Manager' | 'Site Engineer' | 'Approval Engineer' | 'Lab Engineer' | 'Customer';
  password: string;
  organisation_id?: string;
  customer_id?: string;
}

const seedUsers: SeedUser[] = [
  {
    user_id: uuidv4(),
    name: 'System Administrator',
    email: 'admin@backendbore.com',
    role: 'Admin',
    password: 'admin123'
  },
  {
    user_id: uuidv4(),
    name: 'Project Manager',
    email: 'pm@backendbore.com',
    role: 'Project Manager',
    password: 'pm123'
  },
  {
    user_id: uuidv4(),
    name: 'Site Engineer',
    email: 'site@backendbore.com',
    role: 'Site Engineer',
    password: 'site123'
  },
  {
    user_id: uuidv4(),
    name: 'Approval Engineer',
    email: 'approval@backendbore.com',
    role: 'Approval Engineer',
    password: 'approval123'
  },
  {
    user_id: uuidv4(),
    name: 'Lab Engineer',
    email: 'lab@backendbore.com',
    role: 'Lab Engineer',
    password: 'lab123'
  },
  {
    user_id: uuidv4(),
    name: 'Customer User',
    email: 'customer@backendbore.com',
    role: 'Customer',
    password: 'customer123'
  }
];

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

async function seedUsersToDatabase() {
  try {
    console.log('Starting user seeding process...');
    
    // Check if users table exists and has the password_hash column
    const tableCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'password_hash'
    `);
    
    if (tableCheck.length === 0) {
      console.error('Error: password_hash column not found in users table. Please run the migration first.');
      process.exit(1);
    }
    
    // Check if users already exist
    const existingUsers = await db.query('SELECT email FROM users');
    const existingEmails = existingUsers.map((user: any) => user.email);
    
    const newUsers = seedUsers.filter(user => !existingEmails.includes(user.email));
    
    if (newUsers.length === 0) {
      console.log('All users already exist in the database.');
      return;
    }
    
    console.log(`Found ${newUsers.length} new users to seed.`);
    
    // Insert new users
    for (const user of newUsers) {
      const hashedPassword = await hashPassword(user.password);
      
      await db.query(`
        INSERT INTO users (user_id, name, email, role, password_hash, organisation_id, customer_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        user.user_id,
        user.name,
        user.email,
        user.role,
        hashedPassword,
        user.organisation_id || null,
        user.customer_id || null
      ]);
      
      console.log(`✓ Created user: ${user.name} (${user.email}) - Role: ${user.role}`);
    }
    
    console.log('\n✅ User seeding completed successfully!');
    console.log('\nDefault login credentials:');
    console.log('=====================================');
    seedUsers.forEach(user => {
      console.log(`${user.role}: ${user.email} / ${user.password}`);
    });
    console.log('=====================================');
    console.log('\n⚠️  IMPORTANT: Change these passwords in production!');
    
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  } finally {
    // Close database pool
    const pool = await db.getPool();
    await pool.end();
  }
}

// Run the seeding function
seedUsersToDatabase(); 