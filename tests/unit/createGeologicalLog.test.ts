import { handler } from '../../src/handlers/createGeologicalLog';
import { APIGatewayProxyEvent } from 'aws-lambda';

const createFakeEvent = (bodyObj: object): APIGatewayProxyEvent => {
  return {
    body: JSON.stringify(bodyObj),
    headers: {},
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
  it('should return 200 for valid input', async () => {
    const event = createFakeEvent({
      project_name: 'Unit Test Project',
      client_name: 'Client A'
    });

    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.project_name).toBe('Unit Test Project');
  });

  it('should return 400 or 500 for empty input', async () => {
    const event = createFakeEvent({});
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBeGreaterThanOrEqual(400);
    expect(body.success).toBe(false);
  });
});
