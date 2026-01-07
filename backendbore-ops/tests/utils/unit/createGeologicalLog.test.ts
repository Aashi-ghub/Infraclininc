import { handler } from '../../src/handlers/createGeologicalLog';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

// Mock the database module
jest.mock('../../src/models/geologicalLog', () => ({
  insertGeologicalLog: jest.fn().mockImplementation((data) => ({
    ...data,
    borelog_id: uuidv4(),
    created_at: new Date(),
    updated_at: new Date()
  }))
}));

// Mock environment variable for offline mode
process.env.IS_OFFLINE = 'true';

const mockValidGeologicalLog = {
  project_name: 'Test Project',
  client_name: 'Test Client',
  design_consultant: 'Test Consultant',
  job_code: 'TEST-001',
  project_location: 'Test Location',
  area: 'Test Area',
  borehole_location: 'BH-001',
  borehole_number: 'BH-001',
  method_of_boring: 'Rotary',
  diameter_of_hole: 100,
  commencement_date: new Date().toISOString(),
  completion_date: new Date().toISOString(),
  termination_depth: 50,
  logged_by: 'Test Engineer',
  checked_by: 'Test Supervisor',
  created_by_user_id: uuidv4()
};

const createFakeEvent = (bodyObj: object): APIGatewayProxyEvent => {
  return {
    body: JSON.stringify(bodyObj),
    headers: {
      Authorization: 'mock-jwt-token-for-development'
    },
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/geological-log',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: ''
  };
};

describe('createGeologicalLog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 201 for valid input', async () => {
    const event = createFakeEvent(mockValidGeologicalLog);
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.project_name).toBe(mockValidGeologicalLog.project_name);
    expect(body.data.borelog_id).toBeDefined();
  });

  it('should return 400 for missing required fields', async () => {
    const event = createFakeEvent({
      project_name: 'Test Project'
      // Missing other required fields
    });
    
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });

  it('should return 400 for invalid input', async () => {
    const event = createFakeEvent({
      ...mockValidGeologicalLog,
      diameter_of_hole: 'invalid' // Should be a number
    });
    
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });
});
