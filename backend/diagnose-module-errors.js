#!/usr/bin/env node

/**
 * Diagnostic script to find exact module loading issues
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Diagnosing Module Loading Issues\n');
console.log('=' .repeat(60));

// Check 1: package.json has aws-sdk
console.log('\n1. Checking package.json...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const hasAwsSdk = packageJson.dependencies && packageJson.dependencies['aws-sdk'];
console.log(`   aws-sdk in package.json: ${hasAwsSdk ? '✅ YES' : '❌ NO'}`);
if (hasAwsSdk) {
  console.log(`   Version: ${hasAwsSdk}`);
}

// Check 2: node_modules has aws-sdk
console.log('\n2. Checking node_modules...');
const nodeModulesPath = path.join(process.cwd(), 'node_modules', 'aws-sdk');
const hasNodeModules = fs.existsSync(nodeModulesPath);
console.log(`   aws-sdk in node_modules: ${hasNodeModules ? '✅ YES' : '❌ NO'}`);
if (hasNodeModules) {
  const packageJsonPath = path.join(nodeModulesPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const awsSdkPackage = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log(`   Installed version: ${awsSdkPackage.version}`);
  }
}

// Check 3: serverless.ts external config
console.log('\n3. Checking serverless.ts external configuration...');
const serverlessContent = fs.readFileSync('serverless.ts', 'utf8');
const externalMatch = serverlessContent.match(/external:\s*\[([^\]]+)\]/s);
if (externalMatch) {
  const externalList = externalMatch[1];
  const hasAwsSdkExternal = externalList.includes("'aws-sdk'") || externalList.includes('"aws-sdk"');
  console.log(`   aws-sdk in external list: ${hasAwsSdkExternal ? '⚠️  YES (will NOT be bundled)' : '✅ NO (will be bundled)'}`);
  console.log(`   External list: ${externalList.trim()}`);
}

// Check 4: Verify handler file exists
console.log('\n4. Checking handler file...');
const handlerPath = path.join(process.cwd(), 'src', 'handlers', 'auth.ts');
const handlerExists = fs.existsSync(handlerPath);
console.log(`   Handler file exists: ${handlerExists ? '✅ YES' : '❌ NO'}`);
if (handlerExists) {
  const handlerContent = fs.readFileSync(handlerPath, 'utf8');
  const hasLoginExport = handlerContent.includes('export const login') || handlerContent.includes('export const login');
  console.log(`   Has 'export const login': ${hasLoginExport ? '✅ YES' : '❌ NO'}`);
  
  // Check for aws-sdk import in handler chain
  const hasAwsSdkImport = handlerContent.includes("from 'aws-sdk'") || handlerContent.includes('from "aws-sdk"');
  console.log(`   Handler imports aws-sdk directly: ${hasAwsSdkImport ? '⚠️  YES' : '✅ NO (imports via other modules)'}`);
}

// Check 5: Check authService imports
console.log('\n5. Checking authService.ts...');
const authServicePath = path.join(process.cwd(), 'src', 'auth', 'authService.ts');
const authServiceExists = fs.existsSync(authServicePath);
console.log(`   authService.ts exists: ${authServiceExists ? '✅ YES' : '❌ NO'}`);
if (authServiceExists) {
  const authServiceContent = fs.readFileSync(authServicePath, 'utf8');
  const importsAwsSdk = authServiceContent.includes("from 'aws-sdk'") || authServiceContent.includes('from "aws-sdk"');
  console.log(`   Imports aws-sdk: ${importsAwsSdk ? '⚠️  YES' : '✅ NO'}`);
}

// Check 6: Check secrets.ts (uses aws-sdk)
console.log('\n6. Checking secrets.ts...');
const secretsPath = path.join(process.cwd(), 'src', 'utils', 'secrets.ts');
const secretsExists = fs.existsSync(secretsPath);
console.log(`   secrets.ts exists: ${secretsExists ? '✅ YES' : '❌ NO'}`);
if (secretsExists) {
  const secretsContent = fs.readFileSync(secretsPath, 'utf8');
  const importsAwsSdk = secretsContent.includes("from 'aws-sdk'") || secretsContent.includes('from "aws-sdk"');
  console.log(`   Imports aws-sdk: ${importsAwsSdk ? '⚠️  YES' : '✅ NO'}`);
  if (importsAwsSdk) {
    const importLine = secretsContent.split('\n').find(line => line.includes('aws-sdk'));
    console.log(`   Import line: ${importLine.trim()}`);
  }
}

// Check 7: Check parquetService.ts (uses aws-sdk)
console.log('\n7. Checking parquetService.ts...');
const parquetPath = path.join(process.cwd(), 'src', 'services', 'parquetService.ts');
const parquetExists = fs.existsSync(parquetPath);
console.log(`   parquetService.ts exists: ${parquetExists ? '✅ YES' : '❌ NO'}`);
if (parquetExists) {
  const parquetContent = fs.readFileSync(parquetPath, 'utf8');
  const importsAwsSdk = parquetContent.includes("from 'aws-sdk'") || parquetContent.includes('from "aws-sdk"');
  console.log(`   Imports aws-sdk: ${importsAwsSdk ? '⚠️  YES' : '✅ NO'}`);
}

// Check 8: Check if package-lock.json exists and is up to date
console.log('\n8. Checking package-lock.json...');
const packageLockPath = path.join(process.cwd(), 'package-lock.json');
const packageLockExists = fs.existsSync(packageLockPath);
console.log(`   package-lock.json exists: ${packageLockExists ? '✅ YES' : '⚠️  NO (run npm install)'}`);
if (packageLockExists) {
  const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
  const hasAwsSdkLock = packageLock.dependencies && packageLock.dependencies['aws-sdk'];
  console.log(`   aws-sdk in package-lock.json: ${hasAwsSdkLock ? '✅ YES' : '❌ NO'}`);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📋 SUMMARY & RECOMMENDATIONS:\n');

const issues = [];

if (!hasAwsSdk) {
  issues.push('❌ aws-sdk is NOT in package.json - Add it to dependencies');
}

if (!hasNodeModules) {
  issues.push('❌ aws-sdk is NOT in node_modules - Run: npm install');
}

if (externalMatch && (externalMatch[1].includes("'aws-sdk'") || externalMatch[1].includes('"aws-sdk"'))) {
  issues.push('⚠️  aws-sdk is in external list - Remove it so it gets bundled');
}

if (issues.length === 0) {
  console.log('✅ All checks passed! If still getting errors:');
  console.log('   1. Run: npm install');
  console.log('   2. Run: serverless deploy');
  console.log('   3. Check CloudWatch logs for runtime errors');
} else {
  issues.forEach(issue => console.log(issue));
  console.log('\n🔧 FIXES NEEDED:');
  if (!hasAwsSdk) {
    console.log('   1. Add "aws-sdk": "^2.1691.0" to package.json dependencies');
  }
  if (!hasNodeModules && hasAwsSdk) {
    console.log('   2. Run: npm install');
  }
  if (externalMatch && (externalMatch[1].includes("'aws-sdk'") || externalMatch[1].includes('"aws-sdk"'))) {
    console.log('   3. Remove "aws-sdk" from external array in serverless.ts');
  }
  console.log('   4. Run: serverless deploy');
}

console.log('\n');
