/**
 * Test script to verify lab request API works
 */

const axios = require('axios');

// API base URL
const API_BASE = 'http://localhost:3000/dev';

// Test the specific lab request ID that was failing
const requestId = 'f8bf2120-9a88-456d-a462-0f7535a949b5';

async function testLabRequest() {
  try {
    console.log(`🔍 Testing lab request API for ID: ${requestId}`);
    
    const response = await axios.get(`${API_BASE}/lab-requests/${requestId}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ API call successful!');
    console.log('📊 Response status:', response.status);
    console.log('📋 Response data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ API call failed:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data?.message);
    console.error('Error:', error.response?.data?.error);
  }
}

testLabRequest();
