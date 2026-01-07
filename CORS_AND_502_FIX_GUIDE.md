# CORS and 502 Error Fix Guide

## Current Issues

1. **502 Bad Gateway** - Lambda function is failing before returning a response
2. **CORS Error** - This is a symptom of the 502 error (no response = no headers)

## Root Cause

The 502 error means your Lambda function is:
- Crashing/erroring before returning a response
- Timing out
- Having database connection issues
- Missing environment variables

When a Lambda fails with 502, **no response headers are returned**, which causes the CORS error.

## Solution Steps

### Step 1: Deploy the Updated Code

The CORS headers have been fixed in the code. You need to deploy:

```bash
# Deploy backend
cd backend
serverless deploy

# Deploy backendbore-ops  
cd ../backendbore-ops
serverless deploy
```

**Note**: Deployments can take 5-10 minutes. Wait for completion.

### Step 2: Check CloudWatch Logs

After deployment, check CloudWatch Logs to see why the Lambda is failing:

```bash
# Check auth login Lambda logs
aws logs tail /aws/lambda/backendbore-dev-login --follow

# Or in AWS Console:
# CloudWatch → Log Groups → /aws/lambda/backendbore-dev-login
```

Look for:
- Error messages
- Stack traces
- Database connection errors
- Missing environment variables

### Step 3: Test the Lambda Directly

In AWS Console → Lambda:
1. Find the `backendbore-dev-login` function
2. Go to "Test" tab
3. Create a test event:
```json
{
  "httpMethod": "POST",
  "path": "/auth/login",
  "body": "{\"email\":\"admin@backendbore.com\",\"password\":\"test\"}",
  "headers": {
    "Content-Type": "application/json"
  }
}
```
4. Run the test to see the actual error

### Step 4: Common 502 Causes and Fixes

#### 1. Database Connection Issues

**Symptoms**: 
- Timeout errors
- "Connection refused" errors
- "ECONNREFUSED" errors

**Fix**:
- Check RDS security groups allow Lambda access
- Verify database connection string in environment variables
- Check if Lambda is in VPC (may need VPC configuration)

#### 2. Missing Environment Variables

**Symptoms**:
- "undefined" errors
- "Cannot read property" errors

**Fix**:
Check `serverless.ts` environment variables are set:
- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`
- `JWT_SECRET`
- `SECRETS_NAME`

#### 3. Lambda Timeout

**Symptoms**:
- Request takes > 30 seconds
- Timeout errors in logs

**Fix**:
- Increase timeout in `serverless.ts` (currently 30s)
- Optimize database queries
- Add connection pooling

#### 4. Import/Module Errors

**Symptoms**:
- "Cannot find module" errors
- "Module not found" errors

**Fix**:
- Verify all dependencies are in `package.json`
- Check `serverless.ts` external dependencies configuration
- Rebuild and redeploy

### Step 5: Verify CORS After Fixing 502

Once the 502 is fixed, verify CORS headers are present:

1. **Browser DevTools → Network Tab**:
   - Make a request to `/auth/login`
   - Check response headers should include:
     - `Access-Control-Allow-Origin: *`
     - `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`
     - `Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With`
     - `Access-Control-Allow-Credentials: true`

2. **Test OPTIONS Preflight**:
   ```bash
   curl -X OPTIONS https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login \
     -H "Origin: https://dwodlititlpa1.cloudfront.net" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -v
   ```
   
   Should return 200 with CORS headers.

## Quick Diagnostic Commands

```bash
# Test the endpoint directly
curl -X POST https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@backendbore.com","password":"test"}' \
  -v

# Check Lambda function exists
aws lambda get-function --function-name backendbore-dev-login

# Check recent logs
aws logs tail /aws/lambda/backendbore-dev-login --since 10m
```

## Expected Behavior After Fix

1. ✅ **200 OK** response with CORS headers
2. ✅ No CORS errors in browser console
3. ✅ Login request succeeds
4. ✅ Response includes all CORS headers

## Next Steps

1. **Deploy both services** (wait for completion)
2. **Check CloudWatch Logs** for the actual error
3. **Fix the underlying issue** (database, env vars, etc.)
4. **Test again** - CORS should work once Lambda returns successfully

## Important Note

The CORS fix is already in the code. The issue is that the Lambda is failing (502), so it never gets to return the CORS headers. Fix the 502 error first, then CORS will work automatically.
