import bcrypt from 'bcryptjs';

async function generateSQL() {
  console.log('Generating SQL to update password hashes...\n');
  
  const passwords = {
    'admin@acme.com': 'admin123',
    'pm@acme.com': 'pm123', 
    'engineer@acme.com': 'site123',
    'approval@acme.com': 'approval123',
    'lab@acme.com': 'lab123'
  };
  
  console.log('-- SQL to update password hashes:');
  console.log('-- Run these queries in pgAdmin:\n');
  
  for (const [email, password] of Object.entries(passwords)) {
    const hash = await bcrypt.hash(password, 10);
    console.log(`-- ${email} / ${password}`);
    console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = '${email}';`);
    console.log('');
  }
  
  console.log('-- Or set all users to use the same password (password123):');
  const universalHash = await bcrypt.hash('password123', 10);
  console.log(`UPDATE users SET password_hash = '${universalHash}';`);
  console.log('');
  console.log('-- After running the above SQL, you can login with:');
  console.log('-- admin@acme.com / password123');
  console.log('-- pm@acme.com / password123');
  console.log('-- engineer@acme.com / password123');
  console.log('-- approval@acme.com / password123');
  console.log('-- lab@acme.com / password123');
}

generateSQL(); 