import { handler } from '../../src/handlers/createBorelogDetails';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

// Mock the database module
jest.mock('../../src/models/borelogDetails', () => ({
  insertBorelogDetails: jest.fn().mockImplementation((data) => ({
    ...data,
    id: uuidv4(),
    created_at: new Date(),
    updated_at: new Date()
  }))
}));

const mockValidBorelogDetails = {
  borelog_id: uuidv4(),
  number: 'BH-001',
  boring_method: 'Rotary',
  hole_diameter: 100,
  commencement_date: new Date().toISOString(),
  completion_date: new Date().toISOString(),
  termination_depth: 50,
  stratum_depth_from: 0,
  stratum_depth_to: 10,
  stratum_thickness_m: 10,
  created_by_user_id: uuidv4()
};

const createFakeEvent = (bodyObj: object): APIGatewayProxyEvent => {
  return {
    body: JSON.stringify(bodyObj),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/borelog-details',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: ''
  };
};

describe('createBorelogDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 201 for valid input', async () => {
    const event = createFakeEvent(mockValidBorelogDetails);
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.borelog_id).toBe(mockValidBorelogDetails.borelog_id);
    expect(body.data.number).toBe(mockValidBorelogDetails.number);
  });

  it('should return 400 for missing required fields', async () => {
    const event = createFakeEvent({
      borelog_id: uuidv4()
      // Missing other required fields
    });
    
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });

  it('should return 400 for invalid depth values', async () => {
    const event = createFakeEvent({
      ...mockValidBorelogDetails,
      stratum_depth_from: 10,
      stratum_depth_to: 5 // Invalid: to < from
    });
    
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });

  it('should return 400 for invalid date range', async () => {
    const event = createFakeEvent({
      ...mockValidBorelogDetails,
      commencement_date: new Date('2023-12-01').toISOString(),
      completion_date: new Date('2023-11-01').toISOString() // Invalid: completion before commencement
    });
    
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });

  it('should return 400 for invalid coordinate format', async () => {
    const event = createFakeEvent({
      ...mockValidBorelogDetails,
      coordinate: {
        type: 'InvalidType',
        coordinates: [181, 91] // Invalid longitude/latitude
      }
    });
    
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });
}); 