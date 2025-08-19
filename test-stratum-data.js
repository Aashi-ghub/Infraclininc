/**
 * Test script specifically for testing stratum data handling
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// API base URL
const API_BASE = 'http://localhost:3000/dev';

// Auth token
let authToken = '';

// Test data - using the IDs from previous tests
const testData = {
  substructureId: '379010e2-d069-444a-a497-8ae15b716d9f',
  borelogId: 'd60f6bd7-75a8-45f2-8915-29855bb87b6d'
};

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

// Get borelog by substructure ID
async function getBorelogBySubstructureId(substructureId) {
  try {
    const response = await apiRequest('get', `/borelog/substructure/${substructureId}`);
    console.log(`✅ Borelog retrieved: ${response.data.borelog_id}`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get borelog:', error);
    throw error;
  }
}

// Test stratum data handling
async function testStratumData() {
  try {
    console.log('🔍 Testing stratum data handling...');
    
    // Step 1: Login
    await login('admin@acme.com', 'password123');
    
    // Step 2: Get borelog data
    const borelog = await getBorelogBySubstructureId(testData.substructureId);
    const versions = borelog.version_history;
    const latestVersion = versions[0];
    
    console.log(`Latest version: ${latestVersion.version_no}`);
    
    // Step 3: Create test stratum data
    const stratumData = [
      {
        id: uuidv4(),
        parent_id: null,
        is_subdivision: false,
        description: 'Sandy clay, medium plasticity, brown',
        depth_from: 0,
        depth_to: 5.5,
        thickness: 5.5,
        sample_type: 'DS',
        sample_depth: '3.0',
        run_length: 1.5,
        spt_15cm_1: 10,
        spt_15cm_2: 12,
        spt_15cm_3: 15,
        n_value: 27,
        total_core_length: 145,
        tcr_percent: 96.7,
        rqd_length: 120,
        rqd_percent: 80,
        return_water_color: 'Brown',
        water_loss: 'Minimal',
        borehole_diameter: '150',
        remarks: 'Test stratum 1',
        is_collapsed: false
      },
      {
        id: uuidv4(),
        parent_id: null,
        is_subdivision: false,
        description: 'Weathered sandstone, medium-grained, light brown',
        depth_from: 5.5,
        depth_to: 12.0,
        thickness: 6.5,
        sample_type: 'CS',
        sample_depth: '8.0',
        run_length: 1.5,
        spt_15cm_1: 25,
        spt_15cm_2: 30,
        spt_15cm_3: 35,
        n_value: 65,
        total_core_length: 148,
        tcr_percent: 98.7,
        rqd_length: 135,
        rqd_percent: 90,
        return_water_color: 'Clear',
        water_loss: 'None',
        borehole_diameter: '150',
        remarks: 'Test stratum 2',
        is_collapsed: false
      }
    ];
    
    // Step 4: Try different approaches to send stratum data
    console.log('\n📋 Testing different approaches for stratum data:');
    
    // Approach 1: Send as individual arrays (the way backend schema expects)
    const approach1Data = {
      borelog_id: testData.borelogId,
      substructure_id: testData.substructureId,
      project_id: borelog.project.project_id,
      type: borelog.borelog_type || 'Geological',
      status: 'draft',
      version_no: latestVersion.version_no + 1,
      
      // Basic fields
      number: `STRATUM-TEST-1-${Date.now()}`,
      msl: '100',
      boring_method: 'Rotary Drilling',
      hole_diameter: 150,
      commencement_date: new Date().toISOString(),
      completion_date: new Date().toISOString(),
      standing_water_level: 25,
      termination_depth: 50,
      
      // Coordinates
      coordinate: {
        type: 'Point',
        coordinates: [123.456, 78.910]
      },
      
      // Extract stratum data into arrays
      stratum_description: stratumData.map(s => s.description),
      stratum_depth_from: stratumData.map(s => s.depth_from),
      stratum_depth_to: stratumData.map(s => s.depth_to),
      stratum_thickness_m: stratumData.map(s => s.thickness),
      sample_event_type: stratumData.map(s => s.sample_type),
      sample_event_depth_m: stratumData.map(s => parseFloat(s.sample_depth)),
      run_length_m: stratumData.map(s => s.run_length),
      spt_blows_per_15cm: stratumData.map(s => [s.spt_15cm_1, s.spt_15cm_2, s.spt_15cm_3]),
      n_value_is_2131: stratumData.map(s => String(s.n_value)),
      total_core_length_cm: stratumData.map(s => s.total_core_length),
      tcr_percent: stratumData.map(s => s.tcr_percent),
      rqd_length_cm: stratumData.map(s => s.rqd_length),
      rqd_percent: stratumData.map(s => s.rqd_percent),
      return_water_colour: stratumData.map(s => s.return_water_color),
      water_loss: stratumData.map(s => s.water_loss),
      borehole_diameter: stratumData.map(s => parseFloat(s.borehole_diameter)),
      remarks: 'Test with stratum data as arrays'
    };
    
    console.log('Trying approach 1: Send as individual arrays...');
    try {
      const response1 = await apiRequest('post', '/borelog/version', approach1Data);
      console.log(`✅ Approach 1 successful! New version: ${response1.data.version_no}`);
      
      // Verify the data was saved
      const updatedBorelog = await getBorelogBySubstructureId(testData.substructureId);
      const newVersion = updatedBorelog.version_history[0];
      
      console.log('Checking if stratum data was saved:');
      console.log(`stratum_description: ${newVersion.details.stratum_description ? 'Present' : 'NULL'}`);
      console.log(`stratum_depth_from: ${newVersion.details.stratum_depth_from ? 'Present' : 'NULL'}`);
      console.log(`stratum_depth_to: ${newVersion.details.stratum_depth_to ? 'Present' : 'NULL'}`);
      
    } catch (error) {
      console.log('❌ Approach 1 failed');
    }
    
    // Approach 2: Try to send as stratum_data field (not in schema)
    const approach2Data = {
      borelog_id: testData.borelogId,
      substructure_id: testData.substructureId,
      project_id: borelog.project.project_id,
      type: borelog.borelog_type || 'Geological',
      status: 'draft',
      version_no: latestVersion.version_no + 2,
      
      // Basic fields
      number: `STRATUM-TEST-2-${Date.now()}`,
      msl: '100',
      boring_method: 'Rotary Drilling',
      hole_diameter: 150,
      commencement_date: new Date().toISOString(),
      completion_date: new Date().toISOString(),
      standing_water_level: 25,
      termination_depth: 50,
      
      // Coordinates
      coordinate: {
        type: 'Point',
        coordinates: [123.456, 78.910]
      },
      
      // Send as stratum_data field
      stratum_data: JSON.stringify(stratumData),
      remarks: 'Test with stratum_data as JSON string'
    };
    
    console.log('\nTrying approach 2: Send as stratum_data field...');
    try {
      const response2 = await apiRequest('post', '/borelog/version', approach2Data);
      console.log(`✅ Approach 2 successful! New version: ${response2.data.version_no}`);
    } catch (error) {
      console.log('❌ Approach 2 failed');
    }
    
    console.log('\n🔍 Test complete');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testStratumData();

