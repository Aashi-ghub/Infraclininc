# Verify API Gateway Deployment

Since the service is deployed but you're getting "Missing Authentication Token", let's verify the API Gateway configuration.

## Quick Checks

### 1. Verify Lambda Function Exists

```bash
aws lambda get-function --function-name backendbore-dev-login
```

If this works, the Lambda is deployed. If not, that's the issue.

### 2. Check API Gateway Routes

```bash
# List all REST APIs
aws apigateway get-rest-apis --query "items[?contains(name, 'backendbore')]"

# Get the API ID (replace YOUR_API_ID)
aws apigateway get-resources --rest-api-id YOUR_API_ID --query "items[?pathPart=='auth']"
```

### 3. Verify the Route Exists

In AWS Console:
1. Go to **API Gateway** → Find your API
2. Click **Resources**
3. Look for the path structure:
   - `/dev` (or root `/`)
   - `/auth`
   - `/login` (under `/auth`)
4. Check if **POST** method exists on `/auth/login`

## Common Issues When Deployed

### Issue 1: Stage Not Deployed

Even if routes exist, the stage might not be deployed.

**Check**:
1. API Gateway → Your API → **Stages**
2. Click on **dev** stage
3. Check **Last Updated** timestamp
4. If it's old or missing, deploy the stage:
   - Go to **Actions** → **Deploy API**
   - Select **dev** stage
   - Click **Deploy**

### Issue 2: Wrong API Gateway

You might have multiple APIs and be using the wrong one.

**Check**:
1. API Gateway → List all APIs
2. Find the one created by Serverless Framework (usually named `backendbore-dev`)
3. Verify the API ID matches your URL: `451vcfv074`

### Issue 3: Path Configuration

The path might be configured differently than expected.

**Check in API Gateway Console**:
- Route might be: `/auth/login` (without `/dev`)
- Or: `/dev/auth/login` (with `/dev`)
- Serverless Framework usually creates routes with the stage prefix

**Test both**:
```bash
# Try with /dev prefix
curl -X POST https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' \
  -v

# Try without /dev prefix (if stage is root)
curl -X POST https://451vcfv074.execute-api.us-east-1.amazonaws.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' \
  -v
```

### Issue 4: Method Mismatch

The route might exist but for a different HTTP method.

**Check**:
1. API Gateway → Resources → `/auth/login`
2. Verify **POST** method exists (not just GET or OPTIONS)
3. If only OPTIONS exists, CORS preflight is working but the actual route isn't

### Issue 5: Integration Not Configured

The route exists but isn't connected to the Lambda.

**Check**:
1. API Gateway → Resources → `/auth/login` → **POST**
2. Click on **POST** method
3. Check **Integration Request**:
   - Integration type should be **Lambda Function**
   - Lambda Function should be `backendbore-dev-login`
   - Lambda Region should be `us-east-1`

## Step-by-Step Verification

### Step 1: Check Serverless Deployment Output

When you ran `serverless deploy`, it should have shown endpoints. Check the output for:

```
endpoints:
  POST - https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login
```

If the URL is different, use that URL instead.

### Step 2: Verify in AWS Console

1. **API Gateway**:
   - Find API: `backendbore-dev` (or similar)
   - Resources → Verify `/auth/login` exists
   - Check POST method is configured

2. **Lambda**:
   - Find function: `backendbore-dev-login`
   - Configuration → Triggers
   - Should show API Gateway trigger

### Step 3: Test with Different Paths

Try these variations:

```bash
# Variation 1: With /dev
curl -X POST https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'

# Variation 2: Without /dev (if stage is root)
curl -X POST https://451vcfv074.execute-api.us-east-1.amazonaws.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'

# Variation 3: Check OPTIONS (CORS preflight)
curl -X OPTIONS https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login \
  -H "Origin: https://dwodlititlpa1.cloudfront.net" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

### Step 4: Check CloudWatch Logs

If the Lambda is being invoked, you'll see logs:

```bash
aws logs tail /aws/lambda/backendbore-dev-login --follow
```

- **If you see logs**: Lambda is being called, check for errors
- **If no logs**: Request isn't reaching Lambda (API Gateway issue)

## Diagnostic Commands

```bash
# 1. Get API Gateway ID from URL
# Your URL: https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login
# API ID: 451vcfv074

# 2. List resources in the API
aws apigateway get-resources --rest-api-id 451vcfv074

# 3. Get specific resource (auth)
aws apigateway get-resources --rest-api-id 451vcfv074 \
  --query "items[?pathPart=='auth']"

# 4. Get stages
aws apigateway get-stages --rest-api-id 451vcfv074

# 5. Test the endpoint
curl -X POST https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' \
  -v 2>&1 | grep -E "(HTTP|message|Missing)"
```

## Most Likely Issues

### 1. Stage Not Deployed (90% of cases)
**Fix**: Deploy the stage in API Gateway Console

### 2. Wrong Path (5% of cases)
**Fix**: Use the exact path from deployment output

### 3. Method Not Configured (3% of cases)
**Fix**: Verify POST method exists in API Gateway

### 4. Integration Broken (2% of cases)
**Fix**: Reconfigure Lambda integration

## Quick Fix: Redeploy API Gateway Stage

If everything looks correct but still not working:

1. Go to **API Gateway** → Your API
2. **Actions** → **Deploy API**
3. Select **dev** stage
4. Click **Deploy**
5. Wait 30 seconds
6. Test again

## What to Share for Further Help

If still not working, share:

1. Output of: `aws apigateway get-resources --rest-api-id 451vcfv074`
2. Screenshot of API Gateway Resources view
3. Output of: `aws lambda get-function --function-name backendbore-dev-login`
4. Full curl response with `-v` flag
