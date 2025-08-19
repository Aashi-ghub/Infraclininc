const axios = require('axios');

const API_BASE = 'http://localhost:3000/dev';

async function testStratumAPI() {
  try {
    console.log('🔍 Testing Stratum Data API...\n');

    // First, login to get authentication token
    console.log('1. Logging in...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@acme.com',
      password: 'password123'
    });

    if (!loginResponse.data.success) {
      console.log('❌ Login failed');
      return;
    }

    const token = loginResponse.data.data.token;
    console.log('✅ Login successful\n');

    // Set up axios with authentication
    const authAxios = axios.create({
      baseURL: API_BASE,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // Get a borelog to work with
    console.log('2. Getting existing borelog...');
    const borelogResponse = await authAxios.get(`/borelog/substructure/379010e2-d069-444a-a497-8ae15b716d9f`);
    
    if (!borelogResponse.data.success) {
      console.log('❌ Failed to get borelog');
      return;
    }

    const borelog = borelogResponse.data.data;
    const borelogId = borelog.borelog_id;
    const latestVersion = borelog.latest_version?.version_no || 1;

    console.log(`✅ Found borelog: ${borelogId}, latest version: ${latestVersion}\n`);

    // Test saving stratum data
    console.log('3. Testing stratum data save...');
    const stratumData = {
      borelog_id: borelogId,
      version_no: latestVersion,
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      layers: [
        {
          description: 'Sandy clay, medium plasticity, brown',
          depth_from_m: 0,
          depth_to_m: 5.5,
          thickness_m: 5.5,
          return_water_colour: 'Brown',
          water_loss: 'Minimal',
          borehole_diameter: 150,
          remarks: 'Test layer 1',
          samples: [
            {
              sample_type: 'DS-1',
              depth_mode: 'single',
              depth_single_m: 3.0,
              depth_from_m: null,
              depth_to_m: null,
              run_length_m: 1.5,
              spt_15cm_1: 10,
              spt_15cm_2: 8,
              spt_15cm_3: 9,
              n_value: 27,
              total_core_length_cm: 145,
              tcr_percent: 96.7,
              rqd_length_cm: 120,
              rqd_percent: 80
            },
            {
              sample_type: 'U-1',
              depth_mode: 'range',
              depth_single_m: null,
              depth_from_m: 2.0,
              depth_to_m: 3.5,
              run_length_m: 1.5,
              spt_15cm_1: 15,
              spt_15cm_2: 12,
              spt_15cm_3: 14,
              n_value: 41,
              total_core_length_cm: 140,
              tcr_percent: 93.3,
              rqd_length_cm: 125,
              rqd_percent: 83.3
            }
          ]
        },
        {
          description: 'Clay, high plasticity, dark brown',
          depth_from_m: 5.5,
          depth_to_m: 12.0,
          thickness_m: 6.5,
          return_water_colour: 'Dark brown',
          water_loss: 'Moderate',
          borehole_diameter: 150,
          remarks: 'Test layer 2',
          samples: [
            {
              sample_type: 'VS-1',
              depth_mode: 'single',
              depth_single_m: 8.0,
              depth_from_m: null,
              depth_to_m: null,
              run_length_m: 2.0,
              spt_15cm_1: 25,
              spt_15cm_2: 22,
              spt_15cm_3: 24,
              n_value: 71,
              total_core_length_cm: 190,
              tcr_percent: 95.0,
              rqd_length_cm: 160,
              rqd_percent: 80.0
            }
          ]
        }
      ]
    };

    const saveResponse = await authAxios.post(`/stratum-data`, stratumData);
    
    if (saveResponse.data.success) {
      console.log('✅ Stratum data saved successfully');
      console.log(`   - Layers saved: ${saveResponse.data.data.layers_saved}\n`);
    } else {
      console.log('❌ Failed to save stratum data:', saveResponse.data.message);
      return;
    }

    // Test retrieving stratum data
    console.log('4. Testing stratum data retrieval...');
    const getResponse = await authAxios.get(`/stratum-data?borelog_id=${borelogId}&version_no=${latestVersion}`);
    
    if (getResponse.data.success) {
      const retrievedData = getResponse.data.data;
      console.log('✅ Stratum data retrieved successfully');
      console.log(`   - Borelog ID: ${retrievedData.borelog_id}`);
      console.log(`   - Version: ${retrievedData.version_no}`);
      console.log(`   - Layers: ${retrievedData.layers.length}`);
      
      retrievedData.layers.forEach((layer, index) => {
        console.log(`\n   Layer ${index + 1}:`);
        console.log(`     - Description: ${layer.description}`);
        console.log(`     - Depth: ${layer.depth_from_m}m to ${layer.depth_to_m}m`);
        console.log(`     - Thickness: ${layer.thickness_m}m`);
        console.log(`     - Sample points: ${layer.samples.length}`);
        
        layer.samples.forEach((sample, sampleIndex) => {
          console.log(`       Sample ${sampleIndex + 1}: ${sample.sample_type}`);
          console.log(`         - Depth mode: ${sample.depth_mode}`);
          if (sample.depth_mode === 'single') {
            console.log(`         - Depth: ${sample.depth_single_m}m`);
          } else {
            console.log(`         - Depth range: ${sample.depth_from_m}m - ${sample.depth_to_m}m`);
          }
          console.log(`         - SPT values: ${sample.spt_15cm_1}, ${sample.spt_15cm_2}, ${sample.spt_15cm_3} (N=${sample.n_value})`);
        });
      });
    } else {
      console.log('❌ Failed to retrieve stratum data:', getResponse.data.message);
    }

    console.log('\n✅ All stratum API tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testStratumAPI();
