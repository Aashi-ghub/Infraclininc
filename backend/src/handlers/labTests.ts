import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole } from '../utils/validateInput';
import { logger } from '../utils/logger';

// Mock data for lab tests
const mockLabTests = [
  {
    id: 'lt-001',
    borelog_id: 'gl-001',
    test_type: 'Compressive Strength',
    result: 'Compressive strength: 35 MPa',
    tested_by: 'John Doe',
    test_date: '2023-06-15',
    remarks: 'Sample showed good consistency',
    borelog: {
      borehole_number: 'BH-001',
      project_name: 'Highway Expansion Project',
      chainage: '1+200'
    }
  },
  {
    id: 'lt-002',
    borelog_id: 'gl-002',
    test_type: 'Moisture Content',
    result: 'Moisture content: 12.5%',
    tested_by: 'Jane Smith',
    test_date: '2023-06-18',
    remarks: 'Sample was slightly damp',
    borelog: {
      borehole_number: 'BH-002',
      project_name: 'Metro Rail Construction',
      chainage: '0+800'
    }
  },
  {
    id: 'lt-003',
    borelog_id: 'gl-003',
    test_type: 'Density Test',
    result: 'Density: 1850 kg/m³',
    tested_by: 'Mike Johnson',
    test_date: '2023-06-20',
    borelog: {
      borehole_number: 'BH-003',
      project_name: 'Bridge Foundation Survey',
      chainage: '2+500'
    }
  }
];

export const createLabTest = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = checkRole(['Admin'])(event);
    if (authError) {
      return authError;
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // In a real implementation, you would validate the input and save to database
    const newLabTest = {
      id: `lt-${Date.now()}`,
      ...body,
      borelog: {
        borehole_number: 'BH-NEW',
        project_name: 'New Project',
        chainage: '0+000'
      }
    };
    
    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Lab test created successfully',
        data: newLabTest,
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error creating lab test:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Internal server error',
        status: 'error'
      })
    };
  }
};

export const listLabTests = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = checkRole(['Admin', 'Engineer', 'Logger', 'Viewer'])(event);
    if (authError) {
      return authError;
    }
    
    // In a real implementation, you would fetch from database
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Lab tests retrieved successfully',
        data: mockLabTests,
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error listing lab tests:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Internal server error',
        status: 'error'
      })
    };
  }
}; 