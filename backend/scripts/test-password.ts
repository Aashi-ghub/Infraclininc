import bcrypt from 'bcryptjs';

async function testPassword() {
  const password = 'admin123';
  const saltRounds = 10;
  
  console.log('Testing password hashing...');
  console.log('Password:', password);
  
  // Generate hash
  const hash = await bcrypt.hash(password, saltRounds);
  console.log('Generated hash:', hash);
  
  // Test verification
  const isValid = await bcrypt.compare(password, hash);
  console.log('Password verification:', isValid);
  
  // Test with the hash from your database
  const dbHash = '$2a$10$92IXUNpkj00r0Q5byMi.Ye4oKoEa3Ro9IIC/.og/at2.uheWG/igi';
  const isValidWithDbHash = await bcrypt.compare(password, dbHash);
  console.log('Verification with DB hash:', isValidWithDbHash);
  
  // Test with different passwords
  const testPasswords = ['password123', 'admin123', 'pm123', 'site123', 'approval123', 'lab123'];
  
  for (const testPassword of testPasswords) {
    const isValidTest = await bcrypt.compare(testPassword, dbHash);
    console.log(`Password "${testPassword}" matches DB hash:`, isValidTest);
  }
}

testPassword(); 