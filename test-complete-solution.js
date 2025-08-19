/**
 * Final test script to verify the complete borelog functionality
 * This script tests:
 * - Creating a new borelog with stratum data
 * - Saving a draft with stratum data
 * - Loading versions with stratum data
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

// Generate test stratum data
function generateStratumData() {
  return [
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
}

// Main test function
async function testCompleteSolution() {
  try {
    console.log('🔍 Testing complete borelog functionality...');
    
    // Step 1: Login
    await login('admin@acme.com', 'password123');
    
    // Step 2: Get borelog data
    const borelog = await getBorelogBySubstructureId(testData.substructureId);
    const versions = borelog.version_history;
    const latestVersion = versions[0];
    
    console.log(`Latest version: ${latestVersion.version_no}`);
    
    // Step 3: Create a new version with stratum data
    const stratumData = generateStratumData();
    
    const newVersionData = {
      borelog_id: testData.borelogId,
      substructure_id: testData.substructureId,
      project_id: borelog.project.project_id,
      type: borelog.borelog_type || 'Geological',
      status: 'draft',
      version_no: latestVersion.version_no + 1,
      
      // Basic fields
      number: `FINAL-TEST-${Date.now()}`,
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
      
      // Stratum data as JSON string
      stratum_data: JSON.stringify(stratumData),
      
      // Other fields
      permeability_test_count: '3',
      spt_vs_test_count: '5/2',
      undisturbed_sample_count: '4',
      disturbed_sample_count: '2',
      water_sample_count: '1',
      remarks: 'Final test with stratum data'
    };
    
    console.log('Creating new version with stratum data...');
    const newVersion = await saveBorelogVersion(newVersionData);
    
    // Step 4: Verify the new version was created
    const updatedBorelog = await getBorelogBySubstructureId(testData.substructureId);
    const latestVersionAfterSave = updatedBorelog.version_history[0];
    
    console.log('\n📋 Details of the newly created version:');
    console.log(`Version: ${latestVersionAfterSave.version_no}`);
    console.log(`Created by: ${latestVersionAfterSave.created_by?.name || 'Unknown'}`);
    console.log(`Created at: ${new Date(latestVersionAfterSave.created_at).toLocaleString()}`);
    
    // Check key fields
    const details = latestVersionAfterSave.details;
    console.log('\n🔍 Checking key fields:');
    
    const fieldsToCheck = [
      { name: 'number', expected: newVersionData.number },
      { name: 'msl', expected: newVersionData.msl },
      { name: 'boring_method', expected: newVersionData.boring_method },
      { name: 'hole_diameter', expected: newVersionData.hole_diameter },
      { name: 'standing_water_level', expected: newVersionData.standing_water_level },
      { name: 'termination_depth', expected: newVersionData.termination_depth },
      { name: 'remarks', expected: newVersionData.remarks }
    ];
    
    let allFieldsCorrect = true;
    fieldsToCheck.forEach(field => {
      const actual = details[field.name];
      if (String(actual) === String(field.expected)) {
        console.log(`✅ ${field.name}: ${actual}`);
      } else {
        console.log(`❌ ${field.name}: expected ${field.expected}, got ${actual}`);
        allFieldsCorrect = false;
      }
    });
    
    // Check if stratum data was saved
    console.log('\n🔍 Checking stratum data:');
    if (details.stratum_description) {
      console.log('✅ stratum_description field is present');
      console.log(`- description: ${details.stratum_description}`);
      console.log(`- depth_from: ${details.stratum_depth_from}`);
      console.log(`- depth_to: ${details.stratum_depth_to}`);
      console.log(`- thickness: ${details.stratum_thickness_m}`);
      console.log(`- sample_type: ${details.sample_event_type}`);
      console.log(`- sample_depth: ${details.sample_event_depth_m}`);
      console.log(`- run_length: ${details.run_length_m}`);
      console.log(`- spt_blows: ${details.spt_blows_per_15cm}`);
      console.log(`- n_value: ${details.n_value_is_2131}`);
      console.log(`- total_core_length: ${details.total_core_length_cm}`);
      console.log(`- tcr_percent: ${details.tcr_percent}`);
      console.log(`- rqd_length: ${details.rqd_length_cm}`);
      console.log(`- rqd_percent: ${details.rqd_percent}`);
      console.log(`- return_water_color: ${details.return_water_colour}`);
      console.log(`- water_loss: ${details.water_loss}`);
      console.log(`- borehole_diameter: ${details.borehole_diameter}`);
    } else {
      console.log('❌ stratum_description field is missing');
      allFieldsCorrect = false;
    }
    
    // Final result
    if (allFieldsCorrect) {
      console.log('\n✅ All tests passed! The borelog functionality is working correctly.');
    } else {
      console.log('\n❌ Some tests failed. There are still issues with the borelog functionality.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testCompleteSolution();
