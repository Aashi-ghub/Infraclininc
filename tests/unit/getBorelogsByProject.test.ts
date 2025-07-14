import { handler } from '../../src/handlers/getBorelogsByProject';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

const EXISTING_PROJECT_ID = uuidv4();

// Mock the database module
jest.mock('../../src/models/borelogDetails', () => ({
  getBorelogsByProjectId: jest.fn().mockImplementation((projectId) => {
    if (projectId === EXISTING_PROJECT_ID) {
      return [
        {
          borelog_id: uuidv4(),
          project_id: EXISTING_PROJECT_ID,
          number: 'BH-001',
          boring_method: 'Rotary',
          hole_diameter: 100,
          commencement_date: new Date(),
          completion_date: new Date(),
          termination_depth: 50,
          stratum_depth_from: 0,
          stratum_depth_to: 10,
          stratum_thickness_m: 10,
          created_by_user_id: uuidv4(),
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          borelog_id: uuidv4(),
          project_id: EXISTING_PROJECT_ID,
          number: 'BH-002',
          boring_method: 'Rotary',
          hole_diameter: 100,
          commencement_date: new Date(),
          completion_date: new Date(),
          termination_depth: 50,
          stratum_depth_from: 0,
          stratum_depth_to: 10,
          stratum_thickness_m: 10,
          created_by_user_id: uuidv4(),
          created_at: new Date(),
          updated_at: new Date()
        }
      ];
    }
    return [];
  })
}));

const createFakeEvent = (pathParameters: any): APIGatewayProxyEvent => {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/borelogs/project/{project_id}',
    pathParameters,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: ''
  };
};

describe('getBorelogsByProject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 and list of borelogs for existing project', async () => {
    const event = createFakeEvent({ project_id: EXISTING_PROJECT_ID });
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
    expect(body.data[0].project_id).toBe(EXISTING_PROJECT_ID);
    expect(body.data[1].project_id).toBe(EXISTING_PROJECT_ID);
  });

  it('should return 200 and empty array for non-existent project', async () => {
    const event = createFakeEvent({ project_id: uuidv4() });
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(0);
  });

  it('should return 400 for missing project ID', async () => {
    const event = createFakeEvent(null);
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });

  it('should return 400 for invalid project ID format', async () => {
    const event = createFakeEvent({ project_id: 'invalid-uuid-format' });
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });
}); 