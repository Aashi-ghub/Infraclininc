// This file contains test functionality for borelog operations
// All mock data has been removed and replaced with real database queries

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/dev';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your-jwt-token-here';

// API client with authentication
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Test functions for borelog operations
async function testBorelogCreation() {
  try {
    console.log('Testing borelog creation...');
    
    // Get real project data from database
    const projectsResponse = await apiClient.get('/projects');
    if (!projectsResponse.data?.success || !projectsResponse.data.data?.length) {
      console.log('No projects found in database. Please create a project first.');
      return;
    }
    
    const project = projectsResponse.data.data[0];
    
    // Get real substructure data from database
    const substructuresResponse = await apiClient.get('/substructures');
    if (!substructuresResponse.data?.success || !substructuresResponse.data.data?.length) {
      console.log('No substructures found in database. Please create a substructure first.');
      return;
    }
    
    const substructure = substructuresResponse.data.data[0];
    
    const borelogData = {
      substructure_id: substructure.substructure_id,
      project_id: project.project_id,
      type: 'Geological',
      status: 'draft',
      version_no: 1,
      
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
      
      // Stratum data - using real geological data structure
      stratum_data: [
        {
          stratum_depth_from: 0.0,
          stratum_depth_to: 3.5,
          stratum_description: 'Loose to medium dense, dark brown, silty SAND with occasional gravel. Moist.',
          remarks: 'Topsoil layer with organic content.'
        },
        {
          stratum_depth_from: 3.5,
          stratum_depth_to: 8.2,
          stratum_description: 'Medium stiff to stiff, reddish-brown, sandy CLAY with occasional gravel. Medium plasticity.',
          remarks: 'Slight moisture content increase with depth.'
        },
        {
          stratum_depth_from: 8.2,
          stratum_depth_to: 15.7,
          stratum_description: 'Dense to very dense, gray, silty SAND with gravel. Water bearing.',
          remarks: 'Water seepage observed at 12.5m depth.'
        }
      ]
    };

    const response = await apiClient.post('/borelog', borelogData);
    
    if (response.data.success) {
      console.log('✅ Borelog created successfully:', response.data.data.borelog_id);
      return response.data.data.borelog_id;
    } else {
      console.log('❌ Failed to create borelog:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Error creating borelog:', error.response?.data || error.message);
    return null;
  }
}

async function testBorelogRetrieval(borelogId) {
  try {
    console.log('Testing borelog retrieval...');
    
    const response = await apiClient.get(`/borelog/${borelogId}`);
    
    if (response.data.success) {
      console.log('✅ Borelog retrieved successfully');
      console.log('Borelog details:', {
        borelog_id: response.data.data.borelog_id,
        number: response.data.data.number,
        project_name: response.data.data.project_name,
        status: response.data.data.status,
        stratum_count: response.data.data.stratum_data?.length || 0
      });
      return response.data.data;
    } else {
      console.log('❌ Failed to retrieve borelog:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Error retrieving borelog:', error.response?.data || error.message);
    return null;
  }
}

async function testBorelogUpdate(borelogId) {
  try {
    console.log('Testing borelog update...');
    
    const updateData = {
      status: 'submitted',
      remarks: 'Updated via test script',
      stratum_data: [
        {
          stratum_depth_from: 0.0,
          stratum_depth_to: 4.0,
          stratum_description: 'Updated: Loose to medium dense, dark brown, silty SAND with occasional gravel. Moist.',
          remarks: 'Updated topsoil layer description.'
        }
      ]
    };

    const response = await apiClient.put(`/borelog/${borelogId}`, updateData);
    
    if (response.data.success) {
      console.log('✅ Borelog updated successfully');
      return response.data.data;
    } else {
      console.log('❌ Failed to update borelog:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Error updating borelog:', error.response?.data || error.message);
    return null;
  }
}

async function testBorelogVersioning(borelogId) {
  try {
    console.log('Testing borelog versioning...');
    
    // Create a new version
    const versionData = {
      version_no: 2,
      status: 'draft',
      remarks: 'Version 2 created via test script'
    };

    const response = await apiClient.post(`/borelog/${borelogId}/version`, versionData);
    
    if (response.data.success) {
      console.log('✅ Borelog version created successfully');
      return response.data.data;
    } else {
      console.log('❌ Failed to create borelog version:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Error creating borelog version:', error.response?.data || error.message);
    return null;
  }
}

async function testBorelogList() {
  try {
    console.log('Testing borelog listing...');
    
    const response = await apiClient.get('/borelog');
    
    if (response.data.success) {
      console.log('✅ Borelog list retrieved successfully');
      console.log(`Found ${response.data.data.length} borelogs`);
      return response.data.data;
    } else {
      console.log('❌ Failed to retrieve borelog list:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Error retrieving borelog list:', error.response?.data || error.message);
    return null;
  }
}

// Main test function
async function runAllTests() {
  console.log('🚀 Starting borelog functionality tests...\n');
  
  // Test 1: List existing borelogs
  console.log('=== Test 1: List Borelogs ===');
  const existingBorelogs = await testBorelogList();
  
  // Test 2: Create new borelog
  console.log('\n=== Test 2: Create Borelog ===');
  const newBorelogId = await testBorelogCreation();
  
  if (newBorelogId) {
    // Test 3: Retrieve borelog
    console.log('\n=== Test 3: Retrieve Borelog ===');
    await testBorelogRetrieval(newBorelogId);
    
    // Test 4: Update borelog
    console.log('\n=== Test 4: Update Borelog ===');
    await testBorelogUpdate(newBorelogId);
    
    // Test 5: Version borelog
    console.log('\n=== Test 5: Borelog Versioning ===');
    await testBorelogVersioning(newBorelogId);
  }
  
  console.log('\n🏁 Borelog functionality tests completed!');
}

// Export functions for use in other test files
module.exports = {
  testBorelogCreation,
  testBorelogRetrieval,
  testBorelogUpdate,
  testBorelogVersioning,
  testBorelogList,
  runAllTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
