# Lambda Function Environment Variables

This document lists all environment variables required for Lambda functions in both **Backend (Main)** and **Backend-Ops**.

---

## 🔑 Required Environment Variables

### ⚠️ IMPORTANT: Database is OPTIONAL

**The system can work with S3 storage only - no database required!**

If you're using **S3-only mode** (no database):
- **DO NOT** set database environment variables
- **DO NOT** set `DB_ENABLED=true`
- Only set `S3_BUCKET_NAME` and related S3 variables

### Database Connection (PostgreSQL) - OPTIONAL

**Only required if you want database functionality:**

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `PGHOST` | PostgreSQL database hostname | `your-db.region.rds.amazonaws.com` | ❌ **NO** (if S3-only) |
| `PGPORT` | PostgreSQL database port | `5432` | ❌ **NO** (if S3-only) |
| `PGDATABASE` | PostgreSQL database name | `backendbore` | ❌ **NO** (if S3-only) |
| `PGUSER` | PostgreSQL database username | `postgres` | ❌ **NO** (if S3-only) |
| `PGPASSWORD` | PostgreSQL database password | `your-secure-password` | ❌ **NO** (if S3-only) |
| `PGSSL` | SSL mode (optional) | `require` | ❌ **NO** (if S3-only) |
| `DB_ENABLED` | Enable database connections | `true` or `false` | ❌ **NO** (defaults to `false`) |

**Note**: 
- If `DB_ENABLED` is not set or set to `false`, database connections are **disabled**
- The system will use S3 storage instead
- **This is the recommended setup for S3-only deployments**

---

### Authentication & Security

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `JWT_SECRET` | Secret key for JWT token signing | `your-long-secure-secret-key` | ✅ **YES** |
| `SECRETS_NAME` | AWS Secrets Manager secret name | `/infra/postgres/secrets-name` | ⚠️ If using Secrets Manager |

**How JWT_SECRET is loaded:**
- **Production**: From AWS Secrets Manager (via `SECRETS_NAME`)
- **Development**: From local `.secrets.json` file or environment variable

---

### AWS Services

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `AWS_REGION` | AWS region | `us-east-1` | ⚠️ Defaults to `us-east-1` |
| `S3_BUCKET_NAME` | S3 bucket for file storage | `backendbore-storage-dev` | ✅ **YES** (if using S3) |
| `PARQUET_LAMBDA_FUNCTION_NAME` | Name of Parquet Lambda function | `parquet-repository-dev-parquet-repository` | ⚠️ If using Parquet |
| `BORELOG_PARSER_QUEUE_URL` | SQS queue URL for borelog parsing | `https://sqs.us-east-1.amazonaws.com/.../borelog-parser-queue-dev` | ⚠️ If using SQS |

---

### Storage Configuration

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `STORAGE_MODE` | Storage mode (`s3` or `local`) | `s3` | ⚠️ Defaults based on environment |
| `LOCAL_STORAGE_PATH` | Local storage path (dev only) | `/tmp/local-storage` | ⚠️ Dev only |
| `IS_OFFLINE` | Whether running offline | `true` or `false` | ⚠️ Dev only |

**Storage Mode Logic:**
- If `IS_OFFLINE=true` → Uses `local` storage
- If in Lambda (`AWS_EXECUTION_ENV` exists) → Uses `s3` storage
- Otherwise → Uses `s3` storage

---

### Application Configuration

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Node environment | `production` or `development` | ⚠️ Recommended |
| `LOG_LEVEL` | Logging level | `info`, `debug`, `warn`, `error` | ⚠️ Defaults to `info` |
| `DB_ENABLED` | Enable database connections | `true` or `false` | ⚠️ Defaults to `false` |

---

## 📋 Environment Variables by Service

### Backend (Main) - `451vcfv074.execute-api.us-east-1.amazonaws.com`

**Required (S3-Only Mode - No Database):**
```bash
# Storage (REQUIRED)
S3_BUCKET_NAME=backendbore-storage-dev

# Authentication (REQUIRED)
JWT_SECRET=your-jwt-secret
# OR use SECRETS_NAME if using AWS Secrets Manager
```

**Optional:**
```bash
AWS_REGION=us-east-1
SECRETS_NAME=/infra/postgres/secrets-name
PARQUET_LAMBDA_FUNCTION_NAME=parquet-repository-dev-parquet-repository
BORELOG_PARSER_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/.../borelog-parser-queue-dev
NODE_ENV=production
LOG_LEVEL=info
STORAGE_MODE=s3
```

**If Using Database (Optional):**
```bash
# Only set these if you want database functionality
DB_ENABLED=true
PGHOST=your-rds-endpoint.region.rds.amazonaws.com
PGPORT=5432
PGDATABASE=backendbore
PGUSER=postgres
PGPASSWORD=your-password
```

---

### Backend-Ops - `uby3f1n6zi.execute-api.us-east-1.amazonaws.com`

**Required (S3-Only Mode - No Database):**
```bash
# Storage (REQUIRED)
S3_BUCKET_NAME=backendbore-storage-dev

# Authentication (REQUIRED)
JWT_SECRET=your-jwt-secret
# OR use SECRETS_NAME if using AWS Secrets Manager
```

**Optional:**
```bash
AWS_REGION=us-east-1
SECRETS_NAME=/infra/postgres/secrets-name
PARQUET_LAMBDA_FUNCTION_NAME=parquet-repository-dev-parquet-repository
BORELOG_PARSER_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/.../borelog-parser-queue-dev
NODE_ENV=production
LOG_LEVEL=info
STORAGE_MODE=s3
```

**If Using Database (Optional):**
```bash
# Only set these if you want database functionality
DB_ENABLED=true
PGHOST=your-rds-endpoint.region.rds.amazonaws.com
PGPORT=5432
PGDATABASE=backendbore
PGUSER=postgres
PGPASSWORD=your-password
```

---

## 🔧 How to Set Environment Variables

### Option 1: AWS Lambda Console

1. Go to AWS Console → Lambda
2. Select your Lambda function
3. Go to **Configuration** → **Environment variables**
4. Click **Edit**
5. Add each variable with its value
6. Click **Save**

### Option 2: Serverless Framework (Recommended)

Environment variables are set in `serverless.ts`:

```typescript
provider: {
  environment: {
    PGHOST: process.env.PGHOST || '',
    PGPORT: process.env.PGPORT || '5432',
    PGDATABASE: process.env.PGDATABASE || '',
    PGUSER: process.env.PGUSER || '',
    PGPASSWORD: process.env.PGPASSWORD || '',
    JWT_SECRET: process.env.JWT_SECRET || '',
    // ... etc
  }
}
```

**To deploy with environment variables:**

```bash
# Set variables before deployment
export PGHOST=your-rds-endpoint.region.rds.amazonaws.com
export PGDATABASE=backendbore
export PGUSER=postgres
export PGPASSWORD=your-password
export JWT_SECRET=your-jwt-secret
export S3_BUCKET_NAME=backendbore-storage-dev

# Deploy
cd backend
npm run deploy

cd ../backendbore-ops
npm run deploy
```

### Option 3: AWS Systems Manager Parameter Store

For sensitive values, use SSM Parameter Store:

```typescript
environment: {
  SECRETS_NAME: '${ssm:/infra/postgres/secrets-name}',
  // Lambda will fetch from SSM automatically
}
```

### Option 4: AWS Secrets Manager

For highly sensitive values (recommended for production):

1. Store secrets in AWS Secrets Manager
2. Set `SECRETS_NAME` environment variable
3. Lambda functions will automatically fetch secrets

**Secrets Manager format:**
```json
{
  "JWT_SECRET": "your-jwt-secret",
  "PGPASSWORD": "your-db-password"
}
```

---

## ✅ Verification Checklist

### For S3-Only Mode (No Database):

- [ ] `S3_BUCKET_NAME` is set ✅ **REQUIRED**
- [ ] `JWT_SECRET` is set (or `SECRETS_NAME` points to Secrets Manager) ✅ **REQUIRED**
- [ ] `DB_ENABLED` is **NOT** set or set to `false` ✅ **IMPORTANT**
- [ ] Lambda IAM role has permissions to:
  - [ ] Access S3 (read/write) ✅ **REQUIRED**
  - [ ] Access Secrets Manager (if using `SECRETS_NAME`) ⚠️ Optional
  - [ ] Access SSM Parameter Store (if using) ⚠️ Optional

### If Using Database (Optional):

- [ ] All database connection variables are set (`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`)
- [ ] `DB_ENABLED=true` is set
- [ ] Lambda IAM role has permissions to:
  - [ ] Access RDS (if database in VPC)

---

## 🐛 Common Issues

### Issue: 502 Bad Gateway - Database Connection Failed

**Cause**: Lambda trying to connect to database when it shouldn't

**Solution for S3-Only Mode**:
1. **DO NOT** set `DB_ENABLED=true`
2. **DO NOT** set database environment variables (`PGHOST`, `PGPORT`, etc.)
3. Ensure `S3_BUCKET_NAME` is set correctly
4. Verify Lambda IAM role has S3 permissions

**If you see database connection errors in CloudWatch logs but don't want database:**
- Remove all `PG*` environment variables from Lambda functions
- Ensure `DB_ENABLED` is not set or is `false`
- The system will automatically use S3 storage

### Issue: 502 Bad Gateway - JWT Secret Missing

**Cause**: `JWT_SECRET` not set or `SECRETS_NAME` incorrect

**Solution**:
1. Set `JWT_SECRET` directly, OR
2. Set `SECRETS_NAME` and ensure secret exists in Secrets Manager
3. Verify Lambda IAM role has `secretsmanager:GetSecretValue` permission

### Issue: 502 Bad Gateway - S3 Access Denied

**Cause**: `S3_BUCKET_NAME` not set or Lambda can't access S3

**Solution**:
1. Set `S3_BUCKET_NAME` environment variable
2. Verify Lambda IAM role has S3 read/write permissions
3. Check bucket exists and is in same region

---

## 📝 Quick Reference

**Minimum Required for S3-Only Production (No Database):**
```bash
# Storage (REQUIRED)
S3_BUCKET_NAME=xxx

# Auth (REQUIRED)
JWT_SECRET=xxx  # OR use SECRETS_NAME

# DO NOT set database variables if using S3-only mode
# DO NOT set DB_ENABLED=true
```

**If Using Database (Optional):**
```bash
# Database (only if DB_ENABLED=true)
PGHOST=xxx.rds.amazonaws.com
PGPORT=5432
PGDATABASE=backendbore
PGUSER=postgres
PGPASSWORD=xxx
DB_ENABLED=true

# Auth
JWT_SECRET=xxx

# Storage
S3_BUCKET_NAME=xxx
```

**All Variables:**
```bash
# Database
PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, PGSSL, DB_ENABLED

# Auth
JWT_SECRET, SECRETS_NAME

# AWS
AWS_REGION, S3_BUCKET_NAME, PARQUET_LAMBDA_FUNCTION_NAME, BORELOG_PARSER_QUEUE_URL

# Storage
STORAGE_MODE, LOCAL_STORAGE_PATH, IS_OFFLINE

# App
NODE_ENV, LOG_LEVEL
```

---

**Last Updated**: Environment variables documentation for Lambda functions
