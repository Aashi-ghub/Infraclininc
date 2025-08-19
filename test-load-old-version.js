/**
 * Test script specifically for loading older versions of a borelog
 */

const axios = require('axios');

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

// Helper function to log version details
function logVersionDetails(version) {
  console.log(`Version: ${version.version_no}`);
  console.log(`Created by: ${version.created_by?.name || 'Unknown'}`);
  console.log(`Created at: ${new Date(version.created_at).toLocaleString()}`);
  
  const details = version.details;
  
  // Log key fields
  const keyFields = [
    'number', 'msl', 'boring_method', 'hole_diameter', 
    'commencement_date', 'completion_date', 
    'standing_water_level', 'termination_depth',
    'remarks'
  ];
  
  keyFields.forEach(field => {
    console.log(`${field}: ${details[field] !== undefined ? details[field] : 'NULL'}`);
  });
}

// Main test function
async function testLoadOldVersion() {
  try {
    console.log('🔍 Testing loading old borelog versions...');
    
    // Step 1: Login
    await login('admin@acme.com', 'password123');
    
    // Step 2: Get borelog with version history
    const borelog = await getBorelogBySubstructureId(testData.substructureId);
    const versions = borelog.version_history;
    
    console.log(`Found ${versions.length} versions for borelog ${testData.borelogId}`);
    
    if (versions.length < 2) {
      console.log('❌ Not enough versions to test loading functionality (need at least 2)');
      return;
    }
    
    // Step 3: Select an older version to load (version 1)
    const oldVersion = versions.find(v => v.version_no === 1);
    if (!oldVersion) {
      console.log('❌ Could not find version 1');
      return;
    }
    
    console.log('\n📋 Details of version 1:');
    logVersionDetails(oldVersion);
    
    // Step 4: Create a new version based on version 1 data
    console.log('\n📝 Creating a new version based on version 1 data...');
    
    const oldVersionDetails = oldVersion.details;
    const projectId = borelog.project.project_id;
    
    const newVersionData = {
      borelog_id: testData.borelogId,
      substructure_id: testData.substructureId,
      project_id: projectId,
      type: borelog.borelog_type || 'Geological',
      status: 'draft',
      version_no: versions[0].version_no + 1,
      
      // Copy fields from old version but modify them slightly
      number: `LOADED-V1-${Date.now()}`,
      msl: oldVersionDetails.msl || '45',
      boring_method: oldVersionDetails.boring_method || 'Rotary Drilling',
      hole_diameter: oldVersionDetails.hole_diameter || 467,
      commencement_date: oldVersionDetails.commencement_date || new Date().toISOString(),
      completion_date: oldVersionDetails.completion_date || new Date().toISOString(),
      standing_water_level: oldVersionDetails.standing_water_level || 67,
      termination_depth: oldVersionDetails.termination_depth || 100,
      
      // Add coordinates in correct format
      coordinate: {
        type: 'Point',
        coordinates: [123.456, 78.910]
      },
      
      // Add a remark to identify this test
      remarks: `Test version loaded from version 1 - ${new Date().toISOString()}`
    };
    
    // Step 5: Save the new version
    const response = await apiRequest('post', '/borelog/version', newVersionData);
    console.log(`✅ New version created: ${response.data.version_no}`);
    
    // Step 6: Verify the new version was created
    const updatedBorelog = await getBorelogBySubstructureId(testData.substructureId);
    const newVersion = updatedBorelog.version_history[0]; // Should be the latest
    
    console.log('\n📋 Details of the newly created version:');
    logVersionDetails(newVersion);
    
    // Step 7: Compare fields to verify data was saved correctly
    console.log('\n🔍 Verifying fields were saved correctly:');
    
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
      const actual = newVersion.details[field.name];
      if (String(actual) === String(field.expected)) {
        console.log(`✅ ${field.name}: ${actual}`);
      } else {
        console.log(`❌ ${field.name}: expected ${field.expected}, got ${actual}`);
        allFieldsCorrect = false;
      }
    });
    
    if (allFieldsCorrect) {
      console.log('\n✅ All checked fields were saved correctly');
      console.log('✅ Loading old versions and creating new versions works correctly');
    } else {
      console.log('\n❌ Some fields were not saved correctly');
      console.log('❌ There are issues with loading old versions');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testLoadOldVersion();

