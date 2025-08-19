/**
 * Test script for borelog functionality
 * This script tests:
 * - Creating a new borelog
 * - Saving a draft
 * - Loading versions
 * - Submitting a borelog
 */

// Import required libraries
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// API base URL
const API_BASE = 'http://localhost:3000/dev';

// Auth token - replace with a valid token for your environment
let authToken = '';

// Test data
const testData = {
  projectId: '',
  structureId: '',
  substructureId: '',
  borelogId: '',
  version: 0
};

// Helper function to set auth token
function setAuthToken(token) {
  authToken = token;
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Helper function for API requests
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

// Login function
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

// Get projects
async function getProjects() {
  try {
    const response = await apiRequest('get', '/projects');
    console.log('✅ Projects retrieved:', response.data.length);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get projects:', error);
    throw error;
  }
}

// Get structures for a project
async function getStructures(projectId) {
  try {
    const response = await apiRequest('get', `/structures?project_id=${projectId}`);
    console.log('✅ Structures retrieved:', response.data.length);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get structures:', error);
    throw error;
  }
}

// Get substructures for a structure
async function getSubstructures(projectId, structureId) {
  try {
    const response = await apiRequest('get', `/substructures?project_id=${projectId}&structure_id=${structureId}`);
    console.log('✅ Substructures retrieved:', response.data.length);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get substructures:', error);
    throw error;
  }
}

// Create a new borelog
async function createBorelog(substructureId, projectId) {
  try {
    const data = {
      substructure_id: substructureId,
      project_id: projectId,
      type: 'Geological',
      status: 'draft'
    };
    
    const response = await apiRequest('post', '/borelog', data);
    console.log('✅ Borelog created:', response.data.borelog_id);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create borelog:', error);
    throw error;
  }
}

// Get borelog by substructure ID
async function getBorelogBySubstructureId(substructureId) {
  try {
    const response = await apiRequest('get', `/borelog/substructure/${substructureId}`);
    console.log('✅ Borelog retrieved:', response.data.borelog_id);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get borelog:', error);
    throw error;
  }
}

// Save borelog draft
async function saveBorelogDraft(borelogData) {
  try {
    const response = await apiRequest('post', '/borelog/version', borelogData);
    console.log('✅ Draft saved:', response.data.version_no);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to save draft:', error);
    throw error;
  }
}

// Submit borelog
async function submitBorelog(borelogData) {
  try {
    // Set status to submitted
    borelogData.status = 'submitted';
    
    const response = await apiRequest('post', '/borelog/version', borelogData);
    console.log('✅ Borelog submitted:', response.data.version_no);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to submit borelog:', error);
    throw error;
  }
}

// Generate test borelog data
function generateBorelogData(borelogId, substructureId, projectId, versionNo) {
  return {
    borelog_id: borelogId,
    substructure_id: substructureId,
    project_id: projectId,
    type: 'Geological',
    status: 'draft',
    version_no: versionNo,
    
    // Form fields
    number: `TEST-${Date.now()}`,
    msl: '100.5',
    boring_method: 'Rotary Drilling',
    hole_diameter: 150,
    commencement_date: new Date().toISOString(),
    completion_date: new Date().toISOString(),
    standing_water_level: 25.5,
    termination_depth: 50.0,
    
    // Coordinates
    coordinate: {
      type: 'Point',
      coordinates: [123.456, 78.910]
    },
    
    // Counts
    permeability_test_count: '3',
    spt_vs_test_count: '5/2',
    undisturbed_sample_count: '4',
    disturbed_sample_count: '2',
    water_sample_count: '1',
    
    // Stratum data
    stratum_data: JSON.stringify([
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
    ])
  };
}

// Main test function
async function runTests() {
  try {
    console.log('🔍 Starting borelog functionality tests...');
    
    // Step 1: Login
    await login('admin@acme.com', 'password123');
    
    // Step 2: Get projects
    const projects = await getProjects();
    if (projects.length === 0) {
      throw new Error('No projects found');
    }
    testData.projectId = projects[0].project_id;
    console.log(`Selected project: ${projects[0].name} (${testData.projectId})`);
    
    // Step 3: Get structures
    const structures = await getStructures(testData.projectId);
    if (structures.length === 0) {
      throw new Error('No structures found');
    }
    testData.structureId = structures[0].structure_id;
    console.log(`Selected structure: ${structures[0].description} (${testData.structureId})`);
    
    // Step 4: Get substructures
    const substructures = await getSubstructures(testData.projectId, testData.structureId);
    if (substructures.length === 0) {
      throw new Error('No substructures found');
    }
    testData.substructureId = substructures[0].substructure_id;
    console.log(`Selected substructure: ${substructures[0].type} (${testData.substructureId})`);
    
    // Step 5: Create or get borelog
    let borelog;
    try {
      borelog = await getBorelogBySubstructureId(testData.substructureId);
      console.log('Using existing borelog');
    } catch (error) {
      console.log('No existing borelog found, creating new one');
      borelog = await createBorelog(testData.substructureId, testData.projectId);
    }
    
    testData.borelogId = borelog.borelog_id;
    console.log(`Working with borelog: ${testData.borelogId}`);
    
    // Get the latest version number
    if (borelog.latest_version) {
      testData.version = borelog.latest_version.version_no;
    } else {
      testData.version = 0;
    }
    console.log(`Current version: ${testData.version}`);
    
    // Step 6: Save a draft with test data
    const draftData = generateBorelogData(
      testData.borelogId, 
      testData.substructureId, 
      testData.projectId, 
      testData.version + 1
    );
    
    console.log('Saving draft with test data...');
    const savedDraft = await saveBorelogDraft(draftData);
    console.log(`Draft saved as version ${savedDraft.version_no}`);
    
    // Step 7: Get the borelog again to verify the draft was saved
    const updatedBorelog = await getBorelogBySubstructureId(testData.substructureId);
    console.log('Verifying draft was saved...');
    
    if (updatedBorelog.version_history && updatedBorelog.version_history.length > 0) {
      const latestVersion = updatedBorelog.version_history[0];
      console.log(`Latest version: ${latestVersion.version_no}`);
      console.log('Checking fields...');
      
      // Check some fields to verify data was saved correctly
      const details = latestVersion.details;
      
      const fieldsToCheck = [
        { name: 'number', expected: draftData.number },
        { name: 'msl', expected: draftData.msl },
        { name: 'boring_method', expected: draftData.boring_method },
        { name: 'hole_diameter', expected: draftData.hole_diameter },
        { name: 'standing_water_level', expected: draftData.standing_water_level },
        { name: 'termination_depth', expected: draftData.termination_depth }
      ];
      
      let allFieldsCorrect = true;
      fieldsToCheck.forEach(field => {
        const actual = details[field.name];
        if (actual == field.expected) {
          console.log(`✅ ${field.name}: ${actual}`);
        } else {
          console.log(`❌ ${field.name}: expected ${field.expected}, got ${actual}`);
          allFieldsCorrect = false;
        }
      });
      
      if (allFieldsCorrect) {
        console.log('✅ All checked fields were saved correctly');
      } else {
        console.log('❌ Some fields were not saved correctly');
      }
      
      // Step 8: Submit the borelog
      console.log('Submitting borelog...');
      const submitData = generateBorelogData(
        testData.borelogId, 
        testData.substructureId, 
        testData.projectId, 
        latestVersion.version_no + 1
      );
      
      submitData.number = `SUBMITTED-${Date.now()}`;
      const submittedBorelog = await submitBorelog(submitData);
      console.log(`Borelog submitted as version ${submittedBorelog.version_no}`);
      
      // Step 9: Final verification
      const finalBorelog = await getBorelogBySubstructureId(testData.substructureId);
      console.log(`Final version count: ${finalBorelog.version_history.length}`);
      console.log('Test completed successfully!');
    } else {
      console.log('❌ No version history found after saving draft');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the tests
runTests();
