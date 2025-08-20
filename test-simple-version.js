const axios = require('axios');

// API base URL
const API_BASE = 'http://localhost:3000/dev';

// Auth token
let authToken = '';

// Set auth token for requests
function setAuthToken(token) {
  authToken = token;
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// API request helper
async function apiRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`API Error (${method} ${endpoint}):`, error.response?.data || error.message);
    throw error;
  }
}

// Login
async function login(email, password) {
  try {
    const response = await apiRequest('post', '/auth/login', { email, password });
    setAuthToken(response.data.token);
    console.log('✅ Login successful');
    return response.data;
  } catch (error) {
    console.error('❌ Login failed:', error);
    throw error;
  }
}

// Save borelog version
async function saveBorelogVersion(data) {
  try {
    const response = await apiRequest('post', '/borelog/version', data);
    console.log(`✅ Version saved: ${response.data.version_no}`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to save version:', error);
    throw error;
  }
}

// Main test function
async function testSimpleVersion() {
  try {
    console.log('🔍 Testing simple borelog version creation...');
    
    // Step 1: Login
    await login('admin@acme.com', 'password123');
    
    // Step 2: Create a simple version without stratum_data first
    const simpleVersionData = {
      borelog_id: 'd60f6bd7-75a8-45f2-8915-29855bb87b6d',
      substructure_id: '379010e2-d069-444a-a497-8ae15b716d9f',
      project_id: 'bc2c3004-147e-43a8-b2ea-1af8ca8eefd5',
      type: 'Geotechnical',
      status: 'draft',
      number: `SIMPLE-TEST-${Date.now()}`,
      msl: '100',
      boring_method: 'Rotary Drilling',
      hole_diameter: 150,
      commencement_date: new Date().toISOString(),
      completion_date: new Date().toISOString(),
      standing_water_level: 25,
      termination_depth: 50,
      remarks: 'Simple test without stratum data'
    };
    
    console.log('Creating simple version without stratum data...');
    const simpleVersion = await saveBorelogVersion(simpleVersionData);
    console.log('✅ Simple version created successfully');
    
    // Step 3: Now try with stratum_data
    const stratumData = [
      {
        id: 'test-id-1',
        description: 'Test stratum',
        depth_from: 0,
        depth_to: 5,
        thickness: 5
      }
    ];
    
    const versionWithStratumData = {
      ...simpleVersionData,
      number: `STRATUM-TEST-${Date.now()}`,
      stratum_data: JSON.stringify(stratumData),
      remarks: 'Test with stratum data'
    };
    
    console.log('Creating version with stratum data...');
    const versionWithStratum = await saveBorelogVersion(versionWithStratumData);
    console.log('✅ Version with stratum data created successfully');
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testSimpleVersion();


