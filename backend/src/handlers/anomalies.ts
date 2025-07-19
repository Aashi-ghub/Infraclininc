import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole } from '../utils/validateInput';
import { logger } from '../utils/logger';

// Mock data for anomalies
const mockAnomalies = [
  {
    id: 'a-001',
    reason: 'Unusual soil composition detected',
    status: 'Pending',
    flagged_by: 'John Doe',
    flagged_at: '2023-06-10',
    geological_log: {
      id: 'gl-001',
      project_name: 'Highway Expansion Project',
      borehole_number: 'BH-001',
      client_name: 'Department of Transportation'
    }
  },
  {
    id: 'a-002',
    reason: 'Inconsistent density readings across samples',
    status: 'Accepted',
    flagged_by: 'Jane Smith',
    flagged_at: '2023-06-12',
    geological_log: {
      id: 'gl-002',
      project_name: 'Metro Rail Construction',
      borehole_number: 'BH-002',
      client_name: 'Metro Rail Corporation'
    }
  },
  {
    id: 'a-003',
    reason: 'Unexpected water table level',
    status: 'Rejected',
    flagged_by: 'Mike Johnson',
    flagged_at: '2023-06-14',
    geological_log: {
      id: 'gl-003',
      project_name: 'Bridge Foundation Survey',
      borehole_number: 'BH-003',
      client_name: 'National Highways Authority'
    }
  }
];

export const listAnomalies = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = checkRole(['Admin'])(event);
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
        message: 'Anomalies retrieved successfully',
        data: mockAnomalies,
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error listing anomalies:', error);
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

export const createAnomaly = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = checkRole(['Admin', 'Engineer'])(event);
    if (authError) {
      return authError;
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // In a real implementation, you would validate the input and save to database
    const newAnomaly = {
      id: `a-${Date.now()}`,
      ...body,
      status: 'Pending',
      flagged_at: new Date().toISOString(),
      geological_log: {
        id: body.geological_log_id || 'gl-unknown',
        project_name: 'Unknown Project',
        borehole_number: 'Unknown',
        client_name: 'Unknown Client'
      }
    };
    
    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Anomaly created successfully',
        data: newAnomaly,
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error creating anomaly:', error);
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

export const updateAnomaly = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user has appropriate role
    const authError = checkRole(['Admin'])(event);
    if (authError) {
      return authError;
    }

    // Get anomaly ID from path parameters
    const anomalyId = event.pathParameters?.anomaly_id;
    
    if (!anomalyId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Missing anomaly_id parameter',
          status: 'error'
        })
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // In a real implementation, you would validate the input and update in database
    // Here we just return a mock response
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Anomaly updated successfully',
        data: {
          id: anomalyId,
          ...body,
          updated_at: new Date().toISOString()
        },
        status: 'success'
      })
    };
  } catch (error) {
    logger.error('Error updating anomaly:', error);
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