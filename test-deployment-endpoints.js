#!/usr/bin/env node

/**
 * Comprehensive Endpoint Testing Script
 * Tests all endpoints across Frontend, Backend (Main), and Backend-Ops
 */

const https = require('https');
const http = require('http');

// Production URLs
const FRONTEND_URL = 'https://dwodlititlpa1.cloudfront.net';
const BACKEND_MAIN = 'https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev';
const BACKEND_OPS = 'https://uby3f1n6zi.execute-api.us-east-1.amazonaws.com/dev';

// Test results
const results = {
  frontend: { passed: 0, failed: 0, errors: [] },
  backendMain: { passed: 0, failed: 0, errors: [] },
  backendOps: { passed: 0, failed: 0, errors: [] }
};

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data,
          url: url
        });
      });
    });

    req.on('error', (error) => {
      reject({ error: error.message, url });
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.setTimeout(10000, () => {
      req.destroy();
      reject({ error: 'Request timeout', url });
    });

    req.end();
  });
}

// Test function
async function testEndpoint(name, url, method = 'GET', body = null, headers = {}) {
  try {
    const response = await makeRequest(url, { method, body, headers });
    const isSuccess = response.status >= 200 && response.status < 400;
    
    if (isSuccess || response.status === 401 || response.status === 403) {
      // 401/403 are expected for unauthenticated requests
      console.log(`✅ ${name}: ${response.status} ${response.statusText || ''}`);
      return { success: true, status: response.status };
    } else {
      console.log(`⚠️  ${name}: ${response.status} ${response.statusText || ''}`);
      return { success: false, status: response.status };
    }
  } catch (error) {
    console.log(`❌ ${name}: ERROR - ${error.error || error.message}`);
    return { success: false, error: error.error || error.message };
  }
}

// Test Frontend
async function testFrontend() {
  console.log('\n🌐 Testing Frontend (CloudFront)...');
  console.log('='.repeat(60));
  
  const frontendTests = [
    { name: 'Frontend - Homepage', url: FRONTEND_URL },
    { name: 'Frontend - Root Path', url: `${FRONTEND_URL}/` },
  ];

  for (const test of frontendTests) {
    const result = await testEndpoint(test.name, test.url);
    if (result.success) {
      results.frontend.passed++;
    } else {
      results.frontend.failed++;
      results.frontend.errors.push({ test: test.name, error: result.error || `Status: ${result.status}` });
    }
  }
}

// Test Backend (Main)
async function testBackendMain() {
  console.log('\n🔧 Testing Backend (Main) - 451vcfv074...');
  console.log('='.repeat(60));

  const backendMainTests = [
    // Auth endpoints
    { name: 'Auth - Login (POST)', url: `${BACKEND_MAIN}/auth/login`, method: 'POST', body: { email: 'test@example.com', password: 'test' } },
    { name: 'Auth - Me (GET)', url: `${BACKEND_MAIN}/auth/me`, method: 'GET' },
    
    // Users endpoints
    { name: 'Users - List (GET)', url: `${BACKEND_MAIN}/users`, method: 'GET' },
    { name: 'Users - Lab Engineers (GET)', url: `${BACKEND_MAIN}/users/lab-engineers`, method: 'GET' },
    
    // Projects endpoints
    { name: 'Projects - List (GET)', url: `${BACKEND_MAIN}/projects`, method: 'GET' },
    
    // Structures endpoints
    { name: 'Structures - List (GET)', url: `${BACKEND_MAIN}/structures?project_id=test`, method: 'GET' },
    
    // Substructures endpoints
    { name: 'Substructures - List (GET)', url: `${BACKEND_MAIN}/substructures?project_id=test`, method: 'GET' },
    
    // Borelog endpoints
    { name: 'Borelog - Form Data (GET)', url: `${BACKEND_MAIN}/borelog-form-data`, method: 'GET' },
    
    // Boreholes endpoints
    { name: 'Boreholes - List (GET)', url: `${BACKEND_MAIN}/boreholes`, method: 'GET' },
    
    // Geological Log endpoints
    { name: 'Geological Log - List (GET)', url: `${BACKEND_MAIN}/geological-log`, method: 'GET' },
    
    // Borelog Assignments
    { name: 'Borelog Assignments - Active (GET)', url: `${BACKEND_MAIN}/borelog-assignments/active`, method: 'GET' },
  ];

  for (const test of backendMainTests) {
    const result = await testEndpoint(test.name, test.url, test.method, test.body);
    if (result.success) {
      results.backendMain.passed++;
    } else {
      results.backendMain.failed++;
      results.backendMain.errors.push({ test: test.name, error: result.error || `Status: ${result.status}` });
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

// Test Backend-Ops
async function testBackendOps() {
  console.log('\n⚙️  Testing Backend-Ops - uby3f1n6zi...');
  console.log('='.repeat(60));

  const backendOpsTests = [
    // Lab Reports endpoints
    { name: 'Lab Reports - List (GET)', url: `${BACKEND_OPS}/lab-reports`, method: 'GET' },
    
    // Lab Requests endpoints
    { name: 'Lab Requests - List (GET)', url: `${BACKEND_OPS}/lab-requests`, method: 'GET' },
    { name: 'Lab Requests - Final Borelogs (GET)', url: `${BACKEND_OPS}/lab-requests/final-borelogs`, method: 'GET' },
    
    // Lab Tests endpoints
    { name: 'Lab Tests - List (GET)', url: `${BACKEND_OPS}/lab-tests`, method: 'GET' },
    
    // Workflow endpoints
    { name: 'Workflow - Pending Reviews (GET)', url: `${BACKEND_OPS}/workflow/pending-reviews`, method: 'GET' },
    { name: 'Workflow - Lab Assignments (GET)', url: `${BACKEND_OPS}/workflow/lab-assignments`, method: 'GET' },
    { name: 'Workflow - Statistics (GET)', url: `${BACKEND_OPS}/workflow/statistics`, method: 'GET' },
    { name: 'Workflow - Submitted Borelogs (GET)', url: `${BACKEND_OPS}/workflow/submitted-borelogs`, method: 'GET' },
    
    // Unified Lab Reports endpoints
    { name: 'Unified Lab Reports - List (GET)', url: `${BACKEND_OPS}/unified-lab-reports`, method: 'GET' },
    
    // Pending CSV Uploads endpoints
    { name: 'Pending CSV Uploads - List (GET)', url: `${BACKEND_OPS}/pending-csv-uploads`, method: 'GET' },
    
    // Anomalies endpoints
    { name: 'Anomalies - List (GET)', url: `${BACKEND_OPS}/anomalies`, method: 'GET' },
    
    // Contacts endpoints
    { name: 'Contacts - List (GET)', url: `${BACKEND_OPS}/contacts`, method: 'GET' },
  ];

  for (const test of backendOpsTests) {
    const result = await testEndpoint(test.name, test.url, test.method, test.body);
    if (result.success) {
      results.backendOps.passed++;
    } else {
      results.backendOps.failed++;
      results.backendOps.errors.push({ test: test.name, error: result.error || `Status: ${result.status}` });
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

// Test routing from frontend perspective
async function testRouting() {
  console.log('\n🔄 Testing API Routing Logic...');
  console.log('='.repeat(60));
  
  // Test that frontend can make requests (CORS check)
  console.log('Note: Full routing test requires browser environment');
  console.log('Frontend routing is handled by apiRouter.ts');
  console.log('Expected behavior:');
  console.log('  - /auth/*, /users/*, /projects/* → Backend (Main)');
  console.log('  - /lab-reports/*, /workflow/* → Backend-Ops');
}

// Print summary
function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const totalPassed = results.frontend.passed + results.backendMain.passed + results.backendOps.passed;
  const totalFailed = results.frontend.failed + results.backendMain.failed + results.backendOps.failed;
  
  console.log(`\n🌐 Frontend (CloudFront):`);
  console.log(`   ✅ Passed: ${results.frontend.passed}`);
  console.log(`   ❌ Failed: ${results.frontend.failed}`);
  
  console.log(`\n🔧 Backend (Main) - 451vcfv074:`);
  console.log(`   ✅ Passed: ${results.backendMain.passed}`);
  console.log(`   ❌ Failed: ${results.backendMain.failed}`);
  
  console.log(`\n⚙️  Backend-Ops - uby3f1n6zi:`);
  console.log(`   ✅ Passed: ${results.backendOps.passed}`);
  console.log(`   ❌ Failed: ${results.backendOps.failed}`);
  
  console.log(`\n📈 Overall:`);
  console.log(`   ✅ Total Passed: ${totalPassed}`);
  console.log(`   ❌ Total Failed: ${totalFailed}`);
  
  // Print errors if any
  const allErrors = [
    ...results.frontend.errors.map(e => ({ service: 'Frontend', ...e })),
    ...results.backendMain.errors.map(e => ({ service: 'Backend-Main', ...e })),
    ...results.backendOps.errors.map(e => ({ service: 'Backend-Ops', ...e }))
  ];
  
  if (allErrors.length > 0) {
    console.log(`\n⚠️  Errors:`);
    allErrors.forEach(err => {
      console.log(`   - [${err.service}] ${err.test}: ${err.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n💡 Note: 401/403 responses are expected for unauthenticated requests`);
  console.log(`   These indicate the endpoint exists and is properly secured`);
  console.log('='.repeat(60));
}

// Main execution
async function runTests() {
  console.log('🚀 Starting Deployment Endpoint Tests');
  console.log('='.repeat(60));
  console.log(`Frontend: ${FRONTEND_URL}`);
  console.log(`Backend (Main): ${BACKEND_MAIN}`);
  console.log(`Backend-Ops: ${BACKEND_OPS}`);
  
  try {
    await testFrontend();
    await testBackendMain();
    await testBackendOps();
    await testRouting();
    printSummary();
  } catch (error) {
    console.error('\n❌ Fatal error during testing:', error);
    process.exit(1);
  }
}

// Run tests
runTests();
