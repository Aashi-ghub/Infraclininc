import { handler } from '../../src/handlers/getGeologicalLogById';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

const VALID_UUID = uuidv4();

// Mock the database module
jest.mock('../../src/models/geologicalLog', () => ({
  getGeologicalLogById: jest.fn().mockImplementation((id) => {
    if (id === VALID_UUID) {
      return {
        borelog_id: VALID_UUID,
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
        commencement_date: new Date(),
        completion_date: new Date(),
        termination_depth: 50,
        logged_by: 'Test Engineer',
        checked_by: 'Test Supervisor',
        created_by_user_id: uuidv4(),
        created_at: new Date(),
        updated_at: new Date()
      };
    }
    return null;
  })
}));

const createFakeEvent = (pathParameters: any): APIGatewayProxyEvent => {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/geological-log/{borelog_id}',
    pathParameters,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: ''
  };
};

describe('getGeologicalLogById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 and geological log for valid ID', async () => {
    const event = createFakeEvent({ borelog_id: VALID_UUID });
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.borelog_id).toBe(VALID_UUID);
    expect(body.data.project_name).toBe('Test Project');
  });

  it('should return 404 for non-existent ID', async () => {
    const event = createFakeEvent({ borelog_id: uuidv4() });
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });

  it('should return 400 for missing ID parameter', async () => {
    const event = createFakeEvent(null);
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });

  it('should return 400 for invalid ID format', async () => {
    const event = createFakeEvent({ borelog_id: 'invalid-uuid-format' });
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });
}); 