# Lambda Deployment Guide

## Quick Start

### 1. Package Dependencies

```bash
cd backendbore/parquet_storage
pip install -r requirements.txt -t .
```

### 2. Create Deployment Package

```bash
# Create zip file
zip -r lambda_function.zip . -x "*.pyc" "__pycache__/*" "*.md" "test_*.py" "example_*.py"
```

### 3. Deploy to Lambda

**Via AWS CLI:**
```bash
aws lambda create-function \
  --function-name parquet-repository \
  --runtime python3.9 \
  --role arn:aws:iam::ACCOUNT:role/lambda-execution-role \
  --handler lambda_handler.lambda_handler \
  --zip-file fileb://lambda_function.zip \
  --timeout 30 \
  --memory-size 512
```

**Via Serverless Framework:**
```yaml
# serverless.yml
service: parquet-repository

provider:
  name: aws
  runtime: python3.9
  region: us-east-1
  timeout: 30
  memorySize: 512
  environment:
    STORAGE_MODE: s3
    S3_BUCKET_NAME: ${self:custom.bucketName}
    BASE_PATH: parquet-data
    AWS_REGION: ${self:provider.region}

functions:
  parquet:
    handler: lambda_handler.lambda_handler
    events:
      - http:
          path: parquet
          method: ANY
          cors: true
```

### 4. Configure Environment Variables

In Lambda console or via CLI:
```bash
aws lambda update-function-configuration \
  --function-name parquet-repository \
  --environment Variables="{
    STORAGE_MODE=s3,
    S3_BUCKET_NAME=my-parquet-bucket,
    BASE_PATH=parquet-data,
    AWS_REGION=us-east-1
  }"
```

### 5. Set Up API Gateway

1. Create REST API or HTTP API
2. Create resource: `/parquet`
3. Create method: `POST` (or `ANY`)
4. Integration: Lambda Function (`parquet-repository`)
5. Enable CORS

## IAM Role Permissions

Lambda execution role needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
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

## Testing After Deployment

```bash
# Test via AWS CLI
aws lambda invoke \
  --function-name parquet-repository \
  --payload '{
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
    "user": "user-123"
  }' \
  response.json

cat response.json
```

## Monitoring

- CloudWatch Logs: `/aws/lambda/parquet-repository`
- CloudWatch Metrics: Invocations, Duration, Errors
- X-Ray: Enable for detailed tracing

## Troubleshooting

**Cold Start Issues:**
- Increase memory allocation
- Use provisioned concurrency
- Optimize imports

**Timeout Issues:**
- Increase timeout (max 900s)
- Optimize data operations
- Use async operations if needed

**Permission Issues:**
- Check IAM role permissions
- Verify S3 bucket policy
- Check CloudWatch Logs permissions












