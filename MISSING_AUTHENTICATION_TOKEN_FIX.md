# "Missing Authentication Token" Error Fix

## Error Message

```
https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login
{"message":"Missing Authentication Token"}
```

## What This Means

This is **NOT** an authentication error. It's API Gateway saying:
- "I don't know this route"
- "This endpoint doesn't exist in my configuration"

## Common Causes

### 1. Service Not Deployed (Most Likely)
The Lambda functions and API Gateway routes haven't been deployed yet.

**Check**:
```bash
aws lambda get-function --function-name backendbore-dev-login
```

If it returns "ResourceNotFoundException", the service isn't deployed.

**Fix**: Deploy the service
```bash
cd backend
serverless deploy
```

### 2. Wrong HTTP Method
The endpoint is configured for `POST`, but you might be using `GET`.

**Check**: Make sure you're using:
- Method: **POST** (not GET)
- URL: `https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login`

### 3. Path Mismatch
The path might not match exactly.

**Correct path**: `/dev/auth/login` (includes `/dev` stage)

**Check**: Verify the full path includes the stage:
- ✅ `https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login`
- ❌ `https://451vcfv074.execute-api.us-east-1.amazonaws.com/auth/login` (missing `/dev`)

### 4. API Gateway Not Updated
After deploying, API Gateway might need a moment to update, or the deployment might have failed.

**Check**: 
1. Go to AWS Console → API Gateway
2. Find your API (should be named something like `backendbore-dev`)
3. Check if `/auth/login` route exists
4. Check if it's deployed to the `dev` stage

## Step-by-Step Fix

### Step 1: Verify Deployment Status

```bash
# Check if Lambda function exists
aws lambda get-function --function-name backendbore-dev-login

# List all Lambda functions in the service
aws lambda list-functions --query "Functions[?contains(FunctionName, 'backendbore-dev')].FunctionName"
```

### Step 2: Deploy the Service

```bash
cd backend
serverless deploy
```

**Wait for completion** - deployments can take 5-10 minutes.

Look for output like:
```
Service Information
service: backendbore
stage: dev
region: us-east-1
...
endpoints:
  POST - https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login
```

### Step 3: Verify API Gateway Routes

1. Go to **AWS Console → API Gateway**
2. Find your API (should be `backendbore-dev` or similar)
3. Click on **Resources**
4. Look for `/auth/login` under `/dev`
5. Verify it has a **POST** method

### Step 4: Test the Endpoint

**Using curl**:
```bash
curl -X POST https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@backendbore.com","password":"your-password"}' \
  -v
```

**Expected responses**:
- ✅ **200 OK**: Success (with CORS headers)
- ✅ **400 Bad Request**: Missing body or validation error
- ✅ **401 Unauthorized**: Wrong credentials
- ❌ **403 Forbidden**: Route exists but access denied
- ❌ **404 Not Found**: Route doesn't exist
- ❌ **{"message":"Missing Authentication Token"}**: Route doesn't exist

### Step 5: Check API Gateway Stage Deployment

1. Go to **API Gateway → Your API → Stages**
2. Click on **dev** stage
3. Check **Last Updated** timestamp
4. If it's old, you need to redeploy:
   - Go to **Actions → Deploy API**
   - Select **dev** stage
   - Click **Deploy**

## Quick Diagnostic Commands

```bash
# 1. Check if Lambda exists
aws lambda get-function --function-name backendbore-dev-login

# 2. Check API Gateway REST APIs
aws apigateway get-rest-apis --query "items[?contains(name, 'backendbore')]"

# 3. Test the endpoint
curl -X POST https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' \
  -v

# 4. Check CloudWatch Logs (if Lambda exists)
aws logs tail /aws/lambda/backendbore-dev-login --since 10m
```

## Common Scenarios

### Scenario 1: First Time Deployment
**Symptom**: "Missing Authentication Token"  
**Cause**: Service never deployed  
**Fix**: Run `serverless deploy`

### Scenario 2: Partial Deployment
**Symptom**: Some endpoints work, others show "Missing Authentication Token"  
**Cause**: Deployment failed partway through  
**Fix**: Redeploy with `serverless deploy`

### Scenario 3: Wrong API Gateway
**Symptom**: "Missing Authentication Token" but Lambda exists  
**Cause**: Using wrong API Gateway URL  
**Fix**: Check deployment output for correct API Gateway URL

### Scenario 4: Stage Mismatch
**Symptom**: "Missing Authentication Token"  
**Cause**: Using wrong stage (e.g., `/prod/` instead of `/dev/`)  
**Fix**: Use correct stage in URL: `/dev/auth/login`

## Verification Checklist

After deployment, verify:

- [ ] Lambda function `backendbore-dev-login` exists
- [ ] API Gateway has `/dev/auth/login` route
- [ ] Route has **POST** method configured
- [ ] Route is integrated with Lambda function
- [ ] API Gateway stage is deployed
- [ ] CORS is enabled on the route
- [ ] Test endpoint returns 200/400/401 (not 403 or "Missing Authentication Token")

## Expected Behavior After Fix

Once deployed correctly:

```bash
curl -X POST https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@backendbore.com","password":"correct-password"}'
```

**Should return**:
- Status: 200 OK
- Headers: Include CORS headers
- Body: `{"success":true,"message":"Login successful","data":{"token":"...","user":{...}}}`

**NOT**:
- ❌ `{"message":"Missing Authentication Token"}`
- ❌ 403 Forbidden
- ❌ 404 Not Found

## Next Steps

1. **Deploy the service**:
   ```bash
   cd backend
   serverless deploy
   ```

2. **Wait for completion** and note the API Gateway URL from output

3. **Test the endpoint** using the correct URL and method

4. **Check CloudWatch Logs** if you still get errors

5. **Verify API Gateway** configuration in AWS Console
