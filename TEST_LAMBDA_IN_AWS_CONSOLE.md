# How to Test Lambda Functions in AWS Console

## Step-by-Step Guide

### Step 1: Navigate to Lambda

1. Go to [AWS Console](https://console.aws.amazon.com)
2. Search for "Lambda" in the search bar
3. Click on **Lambda** service

### Step 2: Find Your Lambda Function

1. In the Lambda dashboard, you'll see a list of functions
2. Search for your function name:
   - For login: `backendbore-dev-login`
   - For other endpoints: `backendbore-dev-{function-name}`
3. Click on the function name to open it

### Step 3: Create a Test Event

1. Click on the **"Test"** tab (at the top of the function page)
2. Click **"Create new event"** or **"Create event"** button
3. Select **"Create new event"**
4. Give it a name: `test-login` (or any descriptive name)
5. Select template: **"API Gateway AWS Proxy"** (this is the closest match for API Gateway events)

### Step 4: Configure the Test Event

Replace the template JSON with your test event. Here are examples:

#### For Login Endpoint (`/auth/login`):

```json
{
  "httpMethod": "POST",
  "path": "/auth/login",
  "pathParameters": null,
  "queryStringParameters": null,
  "headers": {
    "Content-Type": "application/json",
    "Accept": "application/json"
  },
  "body": "{\"email\":\"admin@backendbore.com\",\"password\":\"your-password\"}",
  "isBase64Encoded": false,
  "requestContext": {
    "requestId": "test-request-id",
    "stage": "dev",
    "resourceId": "test-resource-id",
    "resourcePath": "/auth/login",
    "httpMethod": "POST",
    "requestTime": "09/Apr/2015:12:34:56 +0000",
    "requestTimeEpoch": 1428582896000,
    "identity": {
      "cognitoIdentityPoolId": null,
      "accountId": null,
      "cognitoIdentityId": null,
      "caller": null,
      "accessKey": null,
      "sourceIp": "127.0.0.1",
      "cognitoAuthenticationType": null,
      "cognitoAuthenticationProvider": null,
      "userArn": null,
      "userAgent": "Custom User Agent String",
      "user": null
    },
    "apiId": "test-api-id"
  }
}
```

#### For GET Endpoint (e.g., `/auth/me`):

```json
{
  "httpMethod": "GET",
  "path": "/auth/me",
  "pathParameters": null,
  "queryStringParameters": null,
  "headers": {
    "Authorization": "Bearer your-token-here",
    "Accept": "application/json"
  },
  "body": null,
  "isBase64Encoded": false,
  "requestContext": {
    "requestId": "test-request-id",
    "stage": "dev",
    "resourceId": "test-resource-id",
    "resourcePath": "/auth/me",
    "httpMethod": "GET",
    "requestTime": "09/Apr/2015:12:34:56 +0000",
    "requestTimeEpoch": 1428582896000,
    "identity": {
      "cognitoIdentityPoolId": null,
      "accountId": null,
      "cognitoIdentityId": null,
      "caller": null,
      "accessKey": null,
      "sourceIp": "127.0.0.1",
      "cognitoAuthenticationType": null,
      "cognitoAuthenticationProvider": null,
      "userArn": null,
      "userAgent": "Custom User Agent String",
      "user": null
    },
    "apiId": "test-api-id"
  }
}
```

#### For GET with Query Parameters (e.g., `/projects?name=test`):

```json
{
  "httpMethod": "GET",
  "path": "/projects",
  "pathParameters": null,
  "queryStringParameters": {
    "name": "test"
  },
  "headers": {
    "Accept": "application/json"
  },
  "body": null,
  "isBase64Encoded": false,
  "requestContext": {
    "requestId": "test-request-id",
    "stage": "dev",
    "resourceId": "test-resource-id",
    "resourcePath": "/projects",
    "httpMethod": "GET",
    "requestTime": "09/Apr/2015:12:34:56 +0000",
    "requestTimeEpoch": 1428582896000,
    "identity": {
      "cognitoIdentityPoolId": null,
      "accountId": null,
      "cognitoIdentityId": null,
      "caller": null,
      "accessKey": null,
      "sourceIp": "127.0.0.1",
      "cognitoAuthenticationType": null,
      "cognitoAuthenticationProvider": null,
      "userArn": null,
      "userAgent": "Custom User Agent String",
      "user": null
    },
    "apiId": "test-api-id"
  }
}
```

#### For POST with Path Parameters (e.g., `/geological-log/{borelog_id}`):

```json
{
  "httpMethod": "POST",
  "path": "/geological-log",
  "pathParameters": {
    "borelog_id": "test-borelog-123"
  },
  "queryStringParameters": null,
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer your-token-here"
  },
  "body": "{\"project_name\":\"Test Project\",\"client_name\":\"Test Client\"}",
  "isBase64Encoded": false,
  "requestContext": {
    "requestId": "test-request-id",
    "stage": "dev",
    "resourceId": "test-resource-id",
    "resourcePath": "/geological-log/{borelog_id}",
    "httpMethod": "POST",
    "requestTime": "09/Apr/2015:12:34:56 +0000",
    "requestTimeEpoch": 1428582896000,
    "identity": {
      "cognitoIdentityPoolId": null,
      "accountId": null,
      "cognitoIdentityId": null,
      "caller": null,
      "accessKey": null,
      "sourceIp": "127.0.0.1",
      "cognitoAuthenticationType": null,
      "cognitoAuthenticationProvider": null,
      "userArn": null,
      "userAgent": "Custom User Agent String",
      "user": null
    },
    "apiId": "test-api-id"
  }
}
```

### Step 5: Save and Run the Test

1. Click **"Save"** to save the test event
2. Click **"Test"** button (orange button at the top)
3. Wait for the execution to complete

### Step 6: Review the Results

After execution, you'll see:

1. **Execution result** section showing:
   - Status: Success or Failure
   - Duration: How long it took
   - Memory used
   - Billed duration

2. **Response** section showing:
   - Status code (e.g., 200, 400, 500)
   - Headers (including CORS headers)
   - Body (the actual response)

3. **Log output** section showing:
   - Console.log output
   - Error messages (if any)
   - Stack traces (if errors occurred)

## What to Look For

### ✅ Success Indicators:
- Status: **200 OK**
- Response includes CORS headers:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: ...`
  - `Access-Control-Allow-Headers: ...`
- Body contains expected data

### ❌ Error Indicators:
- Status: **500** or other error codes
- Error messages in Log output
- Stack traces showing where it failed
- Missing CORS headers (if Lambda fails before returning)

## Common Issues and Solutions

### Issue 1: "Cannot find module" or Import Errors
**Solution**: Check that all dependencies are included in the deployment package

### Issue 2: Database Connection Errors
**Solution**: 
- Check environment variables are set correctly
- Verify database is accessible from Lambda
- Check security groups if using RDS

### Issue 3: Timeout Errors
**Solution**: 
- Increase Lambda timeout in configuration
- Check for slow database queries
- Optimize code

### Issue 4: Missing Environment Variables
**Solution**: 
- Go to **Configuration** → **Environment variables**
- Add missing variables
- Redeploy if needed

## Quick Test Event Templates

### Minimal Test Event (Simplest):

```json
{
  "httpMethod": "POST",
  "path": "/auth/login",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"email\":\"admin@backendbore.com\",\"password\":\"test\"}"
}
```

### With Authorization Header:

```json
{
  "httpMethod": "GET",
  "path": "/auth/me",
  "headers": {
    "Authorization": "Bearer your-jwt-token-here"
  },
  "body": null
}
```

## Tips

1. **Save multiple test events** for different scenarios (success, error, etc.)
2. **Check CloudWatch Logs** for more detailed error information
3. **Use the same event structure** that API Gateway sends
4. **Test with and without authentication** to verify auth logic
5. **Check response headers** to verify CORS is working

## Next Steps After Testing

1. If test succeeds: The Lambda is working, issue might be with API Gateway integration
2. If test fails: Fix the error shown in logs, then redeploy
3. If CORS headers missing: Check that `createResponse` is being called correctly
4. If timeout: Increase Lambda timeout or optimize code

## Alternative: Test via API Gateway

You can also test directly via API Gateway:
1. Go to **API Gateway** console
2. Find your API
3. Click on the endpoint (e.g., `/auth/login`)
4. Click **"TEST"** button
5. Configure test parameters
6. Click **"Test"**

This tests the full integration (API Gateway → Lambda), which is closer to real-world usage.
