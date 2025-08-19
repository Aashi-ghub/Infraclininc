/**
 * Test script specifically for borelog version loading functionality
 * This script tests:
 * - Loading different versions of a borelog
 * - Verifying data is correctly loaded from each version
 * - Testing the save draft functionality with loaded versions
 */

const axios = require('axios');

// API base URL
const API_BASE = 'http://localhost:3000/dev';

// Auth token
let authToken = '';

// Test data
const testData = {
  substructureId: '379010e2-d069-444a-a497-8ae15b716d9f', // From previous test
  borelogId: 'd60f6bd7-75a8-45f2-8915-29855bb87b6d'       // From previous test
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

// Save borelog draft with modified data
async function saveBorelogDraft(borelogData) {
  try {
    const response = await apiRequest('post', '/borelog/version', borelogData);
    console.log(`✅ Draft saved as version ${response.data.version_no}`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to save draft:', error);
    throw error;
  }
}

// Test version loading functionality
async function testVersionLoading() {
  try {
    console.log('🔍 Testing borelog version loading functionality...');
    
    // Step 1: Login
    await login('admin@acme.com', 'password123');
    
    // Step 2: Get borelog data with version history
    const borelog = await getBorelogBySubstructureId(testData.substructureId);
    const versions = borelog.version_history;
    
    console.log(`Found ${versions.length} versions for borelog ${testData.borelogId}`);
    
    if (versions.length < 2) {
      console.log('❌ Not enough versions to test loading functionality (need at least 2)');
      return;
    }
    
    // Step 3: Get details from a few different versions
    console.log('\n📋 Checking different versions:');
    
    // Test the latest version
    const latestVersion = versions[0];
    console.log(`\n🔹 Latest version (${latestVersion.version_no}):`);
    logVersionDetails(latestVersion);
    
    // Test the oldest version
    const oldestVersion = versions[versions.length - 1];
    console.log(`\n🔹 Oldest version (${oldestVersion.version_no}):`);
    logVersionDetails(oldestVersion);
    
    // Test a middle version if available
    if (versions.length > 2) {
      const middleIndex = Math.floor(versions.length / 2);
      const middleVersion = versions[middleIndex];
      console.log(`\n🔹 Middle version (${middleVersion.version_no}):`);
      logVersionDetails(middleVersion);
    }
    
    // Step 4: Test saving a draft after loading a version
    console.log('\n📝 Testing save draft functionality with loaded version data...');
    
    // Use data from the oldest version but modify it slightly
    const oldestVersionData = oldestVersion.details;
    
    const draftData = {
      borelog_id: testData.borelogId,
      substructure_id: testData.substructureId,
      project_id: borelog.project.project_id,
      type: borelog.borelog_type || 'Geological',
      status: 'draft',
      version_no: latestVersion.version_no + 1,
      
      // Copy fields from oldest version but modify them
      number: `LOADED-${Date.now()}`,
      msl: oldestVersionData.msl ? String(parseFloat(oldestVersionData.msl) + 10) : '110.5',
      boring_method: oldestVersionData.boring_method || 'Modified Boring Method',
      hole_diameter: oldestVersionData.hole_diameter ? oldestVersionData.hole_diameter + 10 : 160,
      commencement_date: oldestVersionData.commencement_date || new Date().toISOString(),
      completion_date: oldestVersionData.completion_date || new Date().toISOString(),
      standing_water_level: oldestVersionData.standing_water_level ? oldestVersionData.standing_water_level + 5 : 30.5,
      termination_depth: oldestVersionData.termination_depth ? oldestVersionData.termination_depth + 5 : 55.0,
      
      // Handle coordinates properly
      coordinate: {
        type: 'Point',
        coordinates: [123.456, 78.910]
      },
      
      // Other fields
      permeability_test_count: oldestVersionData.permeability_test_count || '3',
      spt_vs_test_count: oldestVersionData.spt_vs_test_count || '5/2',
      undisturbed_sample_count: oldestVersionData.undisturbed_sample_count || '4',
      disturbed_sample_count: oldestVersionData.disturbed_sample_count || '2',
      water_sample_count: oldestVersionData.water_sample_count || '1',
      
      // Add a remark to identify this test
      remarks: `Test version loaded from version ${oldestVersion.version_no} and modified - ${new Date().toISOString()}`
    };
    
    console.log('Saving draft with data loaded from version:', oldestVersion.version_no);
    const savedDraft = await saveBorelogDraft(draftData);
    
    // Step 5: Verify the new draft was saved with the correct data
    const updatedBorelog = await getBorelogBySubstructureId(testData.substructureId);
    const newVersion = updatedBorelog.version_history[0]; // Should be the latest
    
    console.log('\n✅ Verification of saved draft:');
    console.log(`Version: ${newVersion.version_no}`);
    
    // Check if key fields were saved correctly
    const fieldsToCheck = [
      { name: 'number', expected: draftData.number },
      { name: 'msl', expected: draftData.msl },
      { name: 'boring_method', expected: draftData.boring_method },
      { name: 'hole_diameter', expected: draftData.hole_diameter },
      { name: 'standing_water_level', expected: draftData.standing_water_level },
      { name: 'termination_depth', expected: draftData.termination_depth },
      { name: 'remarks', expected: draftData.remarks }
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
      console.log('\n✅ All checked fields were saved correctly after loading a version');
      console.log('✅ Version loading and saving functionality is working correctly');
    } else {
      console.log('\n❌ Some fields were not saved correctly after loading a version');
      console.log('❌ Version loading and saving functionality has issues');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Helper function to log version details
function logVersionDetails(version) {
  const details = version.details;
  console.log(`Created by: ${version.created_by?.name || 'Unknown'}`);
  console.log(`Created at: ${new Date(version.created_at).toLocaleString()}`);
  
  // Log key fields
  const keyFields = [
    'number', 'msl', 'boring_method', 'hole_diameter', 
    'commencement_date', 'completion_date', 
    'standing_water_level', 'termination_depth'
  ];
  
  keyFields.forEach(field => {
    console.log(`${field}: ${details[field] !== undefined ? details[field] : 'NULL'}`);
  });
  
  // Check if stratum data exists
  if (details.stratum_data) {
    try {
      const stratumData = typeof details.stratum_data === 'string' 
        ? JSON.parse(details.stratum_data) 
        : details.stratum_data;
      
      console.log(`Stratum data: ${Array.isArray(stratumData) ? stratumData.length + ' rows' : 'Not an array'}`);
    } catch (e) {
      console.log(`Stratum data: Invalid JSON`);
    }
  } else {
    console.log(`Stratum data: NULL`);
  }
  
  // Check remarks
  console.log(`Remarks: ${details.remarks || 'None'}`);
}

// Run the test
testVersionLoading();
