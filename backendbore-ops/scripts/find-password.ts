import bcrypt from 'bcryptjs';

async function findPassword() {
  const dbHash = '$2a$10$92IXUNpkj00r0Q5byMi.Ye4oKoEa3Ro9IIC/.og/at2.uheWG/igi';
  
  console.log('Testing common passwords against the database hash...');
  
  // Common passwords to test
  const commonPasswords = [
    'password',
    'password123',
    'admin',
    'admin123',
    '123456',
    '123456789',
    'qwerty',
    'abc123',
    'password1',
    '123123',
    'admin1234',
    'test',
    'test123',
    'user',
    'user123',
    'demo',
    'demo123',
    'guest',
    'guest123',
    'welcome',
    'welcome123',
    'login',
    'login123',
    'secret',
    'secret123',
    'letmein',
    'letmein123',
    'changeme',
    'changeme123',
    'monkey',
    'monkey123',
    'dragon',
    'dragon123',
    'master',
    'master123',
    'hello',
    'hello123',
    'freedom',
    'freedom123',
    'whatever',
    'whatever123',
    'qwerty123',
    'qwertyuiop',
    '123qwe',
    '123qwe123',
    '1234567890',
    '12345678901',
    '123456789012',
    'password1234',
    'password12345',
    'password123456',
    'admin1234',
    'admin12345',
    'admin123456',
    'root',
    'root123',
    'toor',
    'toor123',
    'system',
    'system123',
    'administrator',
    'administrator123',
    'superuser',
    'superuser123',
    'supervisor',
    'supervisor123',
    'manager',
    'manager123',
    'pm123',
    'site123',
    'approval123',
    'lab123',
    'customer123'
  ];
  
  for (const password of commonPasswords) {
    const isValid = await bcrypt.compare(password, dbHash);
    if (isValid) {
      console.log(`✅ FOUND MATCH! Password: "${password}"`);
      return;
    }
  }
  
  console.log('❌ No common password matches the hash.');
  console.log('The hash might be for a custom password or might be corrupted.');
  
  // Let's also test if the hash is valid
  try {
    await bcrypt.hash('test', 10);
    console.log('✅ Bcrypt is working correctly');
  } catch (error) {
    console.log('❌ Bcrypt error:', error);
  }
}

findPassword(); 