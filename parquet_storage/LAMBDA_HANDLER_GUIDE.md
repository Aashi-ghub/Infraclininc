# Lambda Handler Guide

## Overview

The Lambda handler (`lambda_handler.py`) wraps the Parquet Repository layer to provide an HTTP API endpoint via AWS Lambda and API Gateway.

## Features

- ✅ **Action-based routing** - Routes requests by `action` field
- ✅ **API Gateway compatible** - Handles REST API and HTTP API formats
- ✅ **Structured JSON responses** - Consistent response format
- ✅ **Error handling** - Graceful error handling with proper status codes
- ✅ **Local testing** - Can be tested without AWS Lambda runtime

## Supported Actions

| Action | Method | Description |
|--------|--------|-------------|
| `create` | POST | Create new entity |
| `update` | POST | Update existing entity |
| `get` | GET | Get latest version |
| `approve` | POST | Approve entity |
| `reject` | POST | Reject entity |
| `list` | GET | List entities by project |
| `get_version` | GET | Get specific version |
| `get_history` | GET | Get entity history |

## Request Format

### Direct Invocation (Testing)

```json
{
  "action": "create",
  "entity_type": "borelog",
  "project_id": "project-001",
  "entity_id": "borelog-001",
  "payload": {
    "borelog_id": "uuid-001",
    "version_no": 1,
    "status": "draft",
    "created_by_user_id": "user-123"
  },
  "user": "user-123",
  "comment": "Optional comment"
}
```

### API Gateway Format

**REST API:**
```json
{
  "httpMethod": "POST",
  "path": "/parquet",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"action\":\"create\",\"entity_type\":\"borelog\",...}",
  "pathParameters": null,
  "queryStringParameters": null
}
```

**HTTP API:**
```json
{
  "requestContext": {
    "http": {
      "method": "POST"
    }
  },
  "body": "{\"action\":\"create\",...}"
}
```

## Response Format

All responses follow this format:

```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  },
  "body": "{\"success\":true,\"data\":{...}}"
}
```

### Success Response

```json
{
  "success": true,
  "data": {
    "entity_type": "borelog",
    "project_id": "project-001",
    "entity_id": "borelog-001",
    "data": {...},
    "metadata": {...}
  }
}
```

### Error Response

```json
{
  "error": "Missing required fields",
  "required": ["entity_type", "project_id", "entity_id"]
}
```

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (missing fields, validation error) |
| 404 | Not Found |
| 500 | Internal Server Error |

## Action Details

### Create

**Request:**
```json
{
  "action": "create",
  "entity_type": "borelog",
  "project_id": "project-001",
  "entity_id": "borelog-001",
  "payload": {...},
  "user": "user-123",
  "comment": "Optional"
}
```

**Response:** 201 Created

### Update

**Request:**
```json
{
  "action": "update",
  "entity_type": "borelog",
  "project_id": "project-001",
  "entity_id": "borelog-001",
  "payload": {...},
  "user": "user-123"
}
```

**Response:** 200 OK

### Get

**Request:**
```json
{
  "action": "get",
  "entity_type": "borelog",
  "project_id": "project-001",
  "entity_id": "borelog-001"
}
```

**Response:** 200 OK or 404 Not Found

### Approve

**Request:**
```json
{
  "action": "approve",
  "entity_type": "borelog",
  "project_id": "project-001",
  "entity_id": "borelog-001",
  "approver": "approver-456",
  "comment": "Optional"
}
```

**Response:** 200 OK

### Reject

**Request:**
```json
{
  "action": "reject",
  "entity_type": "borelog",
  "project_id": "project-001",
  "entity_id": "borelog-001",
  "rejector": "approver-456",
  "comment": "Rejection reason"
}
```

**Response:** 200 OK

### List

**Request:**
```json
{
  "action": "list",
  "entity_type": "borelog",
  "project_id": "project-001",
  "status": "approved"  // Optional filter
}
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": [...],
  "count": 5
}
```

### Get Version

**Request:**
```json
{
  "action": "get_version",
  "entity_type": "borelog",
  "project_id": "project-001",
  "entity_id": "borelog-001",
  "version": 1
}
```

**Response:** 200 OK or 404 Not Found

### Get History

**Request:**
```json
{
  "action": "get_history",
  "entity_type": "borelog",
  "project_id": "project-001",
  "entity_id": "borelog-001"
}
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": [...],
  "count": 3
}
```

## Environment Variables

Configure via Lambda environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `STORAGE_MODE` | `s3` or `local` | `local` |
| `BASE_PATH` | Base path for storage | `parquet-data` |
| `S3_BUCKET_NAME` | S3 bucket name (required for S3 mode) | None |
| `AWS_REGION` | AWS region | `us-east-1` |

## Local Testing

Test locally without AWS Lambda:

```python
from lambda_handler import LambdaHandler

handler = LambdaHandler()

event = {
    "action": "create",
    "entity_type": "borelog",
    "project_id": "project-001",
    "entity_id": "borelog-001",
    "payload": {...},
    "user": "user-123"
}

response = handler.handle(event, None)
print(response)
```

Or use the test script:

```bash
python test_lambda_local.py
```

## Deployment

### Lambda Function Configuration

**Runtime:** Python 3.9+  
**Handler:** `lambda_handler.lambda_handler`  
**Timeout:** 30 seconds (adjust based on data size)  
**Memory:** 512 MB (adjust based on data size)

### Dependencies

Package dependencies with Lambda:
```bash
pip install -r requirements.txt -t .
zip -r lambda_function.zip .
```

### API Gateway Setup

1. Create REST API or HTTP API
2. Create resource: `/parquet`
3. Create method: `POST` (or `ANY`)
4. Integration: Lambda Function
5. Enable CORS if needed

### IAM Permissions

For S3 mode, Lambda execution role needs:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name/*",
        "arn:aws:s3:::your-bucket-name"
      ]
    }
  ]
}
```

## Error Handling

The handler catches and handles errors gracefully:

- **Missing fields** → 400 Bad Request
- **Entity not found** → 404 Not Found
- **Validation errors** → 400 Bad Request
- **Unexpected errors** → 500 Internal Server Error

All errors are logged to CloudWatch Logs.

## CORS Support

CORS headers are included in all responses:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: Content-Type`
- `Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS`

## Performance Considerations

- **Handler reuse** - Handler instance reused across invocations
- **Connection pooling** - S3 client reused
- **Cold starts** - First invocation may be slower
- **Timeout** - Adjust based on data size and operations

## Monitoring

Monitor via CloudWatch:
- Lambda invocations
- Duration
- Errors
- Throttles

## Example: Complete Workflow

```python
# 1. Create
{
  "action": "create",
  "entity_type": "borelog",
  "project_id": "project-001",
  "entity_id": "borelog-001",
  "payload": {...},
  "user": "user-123"
}
# → 201 Created

# 2. Update
{
  "action": "update",
  "entity_type": "borelog",
  "project_id": "project-001",
  "entity_id": "borelog-001",
  "payload": {...},
  "user": "user-123"
}
# → 200 OK

# 3. Approve
{
  "action": "approve",
  "entity_type": "borelog",
  "project_id": "project-001",
  "entity_id": "borelog-001",
  "approver": "approver-456"
}
# → 200 OK

# 4. List
{
  "action": "list",
  "entity_type": "borelog",
  "project_id": "project-001"
}
# → 200 OK with list
```

## Constraints (As Requested)

✅ **No business logic** - Pure routing layer  
✅ **No role checks** - User IDs passed through  
✅ **No validation** - Assumes input already validated  
✅ **Ready for deployment** - Lambda-compatible format




