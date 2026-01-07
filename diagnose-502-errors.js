#!/usr/bin/env node

/**
 * Diagnostic Script for 502 Bad Gateway Errors
 * Helps identify why Lambda functions are returning 502 errors
 */

const https = require('https');

const BACKEND_MAIN = 'https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev';
const BACKEND_OPS = 'https://uby3f1n6zi.execute-api.us-east-1.amazonaws.com/dev';

// Test with detailed error capture
function makeDetailedRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const startTime = Date.now();
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Diagnostic-Test/1.0',
        ...options.headers
      },
      timeout: 30000
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      const headers = {};
      
      // Capture all headers
      Object.keys(res.headers).forEach(key => {
        headers[key] = res.headers[key];
      });
      
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: headers,
          data: data,
          duration: duration,
          url: url
        });
      });
    });

    req.on('error', (error) => {
      const duration = Date.now() - startTime;
      reject({ 
        error: error.message, 
        code: error.code,
        duration: duration,
        url 
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({ 
        error: 'Request timeout after 30s', 
        duration: Date.now() - startTime,
        url 
      });
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function diagnoseEndpoint(name, url, method = 'GET', body = null) {
  console.log(`\n🔍 Diagnosing: ${name}`);
  console.log(`   URL: ${url}`);
  console.log(`   Method: ${method}`);
  
  try {
    const response = await makeDetailedRequest(url, { method, body });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Duration: ${response.duration}ms`);
    console.log(`   Response Headers:`);
    Object.keys(response.headers).forEach(key => {
      if (key.toLowerCase().includes('error') || 
          key.toLowerCase().includes('x-') ||
          key.toLowerCase() === 'content-type') {
        console.log(`     ${key}: ${response.headers[key]}`);
      }
    });
    
    // Try to parse error response
    if (response.status >= 400) {
      try {
        const errorData = JSON.parse(response.data);
        console.log(`   Error Details:`, JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log(`   Response Body (first 500 chars):`, response.data.substring(0, 500));
      }
    }
    
    // Check for specific 502 indicators
    if (response.status === 502) {
      console.log(`   ⚠️  502 Bad Gateway - Possible causes:`);
      
      // Check response headers for clues
      if (response.headers['x-amzn-errortype']) {
        console.log(`     - AWS Error Type: ${response.headers['x-amzn-errortype']}`);
      }
      if (response.headers['x-amzn-requestid']) {
        console.log(`     - Request ID: ${response.headers['x-amzn-requestid']}`);
        console.log(`     - Check CloudWatch Logs with this Request ID`);
      }
      
      console.log(`     Possible issues:`);
      console.log(`     1. Lambda function not responding (timeout)`);
      console.log(`     2. Lambda function throwing unhandled error`);
      console.log(`     3. Lambda function missing or not integrated with API Gateway`);
      console.log(`     4. Database connection issues`);
      console.log(`     5. Missing environment variables`);
      console.log(`     6. CORS preflight failing`);
    }
    
    return { success: response.status < 400, status: response.status, response };
  } catch (error) {
    console.log(`   ❌ Request Failed: ${error.error || error.message}`);
    if (error.code) {
      console.log(`   Error Code: ${error.code}`);
    }
    return { success: false, error: error.error || error.message };
  }
}

async function runDiagnostics() {
  console.log('🔧 502 Error Diagnostics');
  console.log('='.repeat(60));
  console.log('This script helps identify why Lambda functions return 502 errors');
  console.log('='.repeat(60));
  
  // Test a few key endpoints from each backend
  const tests = [
    // Backend Main
    { name: 'Backend Main - Users List', url: `${BACKEND_MAIN}/users`, method: 'GET' },
    { name: 'Backend Main - Projects List', url: `${BACKEND_MAIN}/projects`, method: 'GET' },
    { name: 'Backend Main - Auth Me', url: `${BACKEND_MAIN}/auth/me`, method: 'GET' },
    
    // Backend Ops
    { name: 'Backend Ops - Lab Reports', url: `${BACKEND_OPS}/lab-reports`, method: 'GET' },
    { name: 'Backend Ops - Lab Tests', url: `${BACKEND_OPS}/lab-tests`, method: 'GET' },
    { name: 'Backend Ops - Workflow Stats', url: `${BACKEND_OPS}/workflow/statistics`, method: 'GET' },
  ];
  
  const results = [];
  for (const test of tests) {
    const result = await diagnoseEndpoint(test.name, test.url, test.method);
    results.push({ ...test, ...result });
    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between requests
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(60));
  
  const working = results.filter(r => r.success || (r.status && r.status === 403));
  const failing = results.filter(r => !r.success && r.status !== 403);
  
  console.log(`\n✅ Working Endpoints (200/403): ${working.length}`);
  working.forEach(r => {
    console.log(`   - ${r.name}: ${r.status || 'OK'}`);
  });
  
  console.log(`\n❌ Failing Endpoints (502/Error): ${failing.length}`);
  failing.forEach(r => {
    console.log(`   - ${r.name}: ${r.status || r.error}`);
  });
  
  console.log('\n💡 Next Steps:');
  console.log('1. Check AWS CloudWatch Logs for Lambda function errors');
  console.log('2. Verify Lambda functions are integrated with API Gateway routes');
  console.log('3. Check Lambda function environment variables');
  console.log('4. Verify database connections from Lambda functions');
  console.log('5. Check Lambda function timeout settings (should be > 3s)');
  console.log('6. Verify IAM roles have correct permissions');
  console.log('7. Test Lambda functions directly in AWS Console');
  
  console.log('\n📝 To check CloudWatch Logs:');
  console.log('   AWS Console → CloudWatch → Log Groups');
  console.log('   Look for: /aws/lambda/<function-name>');
  console.log('   Filter by Request ID from error headers');
}

runDiagnostics();
