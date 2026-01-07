/**
 * Quick test script to verify login functionality
 * Run: node test_login.js
 */

const fs = require('fs');
const path = require('path');

// Test user loading
console.log('=== Testing User Loading ===');
const usersPath = path.join(__dirname, 'auth', 'users.json');
console.log('Users file path:', usersPath);
console.log('File exists:', fs.existsSync(usersPath));

if (fs.existsSync(usersPath)) {
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
  console.log('Total users:', users.length);
  
  const adminUser = users.find(u => u.email === 'admin@backendbore.com');
  if (adminUser) {
    console.log('\nAdmin user found:');
    console.log('  ID:', adminUser.id);
    console.log('  Email:', adminUser.email);
    console.log('  Password:', adminUser.password);
    console.log('  Password length:', adminUser.password.length);
    console.log('  Role:', adminUser.role);
    console.log('  Name:', adminUser.name);
    
    // Test password comparison
    console.log('\n=== Testing Password Comparison ===');
    const testPassword = 'admin123';
    console.log('Test password:', testPassword);
    console.log('Test password length:', testPassword.length);
    console.log('Stored password:', adminUser.password);
    console.log('Stored password length:', adminUser.password.length);
    console.log('Passwords match:', testPassword === adminUser.password);
    console.log('Passwords match (trimmed):', testPassword.trim() === adminUser.password.trim());
  } else {
    console.log('ERROR: Admin user not found!');
  }
} else {
  console.log('ERROR: Users file not found!');
}











