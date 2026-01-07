# Auth Endpoint Location and Configuration

## ✅ Auth is in Backend (Main) Service

**Location**: `backend/src/handlers/auth.ts`

**Endpoints**:
- `POST /auth/login` - Login (NO authentication required)
- `POST /auth/register` - Register (NO authentication required)  
- `GET /auth/me` - Get current user (REQUIRES authentication token)

**Serverless Configuration**: `backend/serverless.ts`

```typescript
login: {
  handler: 'src/handlers/auth.login',
  events: [
    {
      http: {
        method: 'post',
        path: '/auth/login',
        cors: true
        // NO authorizer configured - login is public!
      }
    }
  ]
}
```

## 🔍 Understanding "Missing Authentication" Error

The "missing authentication" error you're seeing is **NOT** because the endpoint requires auth. It's likely one of these:

### 1. 502 Bad Gateway (Most Likely)
- Lambda function is failing before it can process the request
- API Gateway returns 502, which may show as "missing authentication" in some error messages
- **Solution**: Check CloudWatch Logs to see why Lambda is failing

### 2. API Gateway Authorizer (If Configured Manually)
- Someone may have added an authorizer in AWS Console
- This would block requests before they reach Lambda
- **Check**: AWS Console → API Gateway → Your API → Authorizers

### 3. CORS Preflight Failure
- Browser sends OPTIONS request first
- If OPTIONS fails, it may show authentication error
- **Solution**: Ensure OPTIONS method is configured correctly

## 🧪 How to Test Login Endpoint

### Test 1: Direct Lambda Test (AWS Console)
1. Go to Lambda → `backendbore-dev-login`
2. Test tab → Create test event
3. Use this minimal test:

```json
{
  "httpMethod": "POST",
  "path": "/auth/login",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"email\":\"admin@backendbore.com\",\"password\":\"your-password\"}"
}
```

**Expected Result**:
- ✅ Success: Returns 200 with token
- ❌ Failure: Check logs for actual error (database, env vars, etc.)

### Test 2: Via API Gateway (AWS Console)
1. Go to API Gateway → Your API
2. Find `/auth/login` endpoint
3. Click "TEST"
4. Method: POST
5. Request Body:
```json
{
  "email": "admin@backendbore.com",
  "password": "your-password"
}
```

### Test 3: Via curl/Postman
```bash
curl -X POST https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@backendbore.com","password":"your-password"}' \
  -v
```

## 🔧 Troubleshooting Steps

### Step 1: Check if Lambda Exists and is Deployed
```bash
aws lambda get-function --function-name backendbore-dev-login
```

If it doesn't exist, you need to deploy:
```bash
cd backend
serverless deploy
```

### Step 2: Check CloudWatch Logs
```bash
aws logs tail /aws/lambda/backendbore-dev-login --follow
```

Look for:
- Error messages
- Stack traces
- Database connection errors
- Missing environment variables

### Step 3: Check API Gateway Configuration
1. Go to AWS Console → API Gateway
2. Find your API (should be created by Serverless Framework)
3. Check `/auth/login` endpoint:
   - Method: POST
   - Integration: Lambda Function
   - **NO Authorizer should be configured**
   - CORS: Enabled

### Step 4: Verify Environment Variables
In Lambda Console → Configuration → Environment variables, check:
- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`
- `JWT_SECRET`
- `SECRETS_NAME`

### Step 5: Test Lambda Directly
Use the test event above in Lambda Console to see the actual error.

## 📋 Common Issues

### Issue: "Missing authentication" but endpoint is public
**Cause**: Lambda is failing (502), error message is misleading
**Solution**: Check CloudWatch Logs for actual error

### Issue: Lambda not found
**Cause**: Not deployed or wrong function name
**Solution**: Deploy with `serverless deploy`

### Issue: Database connection error
**Cause**: Lambda can't connect to database
**Solution**: 
- Check security groups
- Verify database credentials
- Check VPC configuration if Lambda is in VPC

### Issue: Missing environment variables
**Cause**: Environment variables not set
**Solution**: 
- Check `serverless.ts` environment configuration
- Redeploy if needed

## ✅ Expected Behavior

### Successful Login Request:
```json
POST /auth/login
{
  "email": "admin@backendbore.com",
  "password": "correct-password"
}

Response: 200 OK
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt-token-here",
    "user": {
      "id": "user-id",
      "email": "admin@backendbore.com",
      "name": "Admin User",
      "role": "Admin"
    }
  }
}
```

### Failed Login (Wrong Password):
```json
Response: 401 Unauthorized
{
  "success": false,
  "message": "Invalid credentials",
  "error": "Email or password is incorrect"
}
```

### Missing Body:
```json
Response: 400 Bad Request
{
  "success": false,
  "message": "Missing request body",
  "error": "Request body is required"
}
```

## 🎯 Key Points

1. ✅ **Auth endpoints ARE in backend (main) service**
2. ✅ **Login endpoint does NOT require authentication** (it's public)
3. ✅ **No API Gateway authorizer configured** in serverless.ts
4. ⚠️ **"Missing authentication" error is likely a 502 error** (Lambda failing)
5. 🔍 **Check CloudWatch Logs** to see the actual error

## Next Steps

1. **Deploy backend service** (if not deployed):
   ```bash
   cd backend
   serverless deploy
   ```

2. **Test Lambda directly** in AWS Console to see actual error

3. **Check CloudWatch Logs** for detailed error messages

4. **Fix the underlying issue** (database, env vars, etc.)

5. **Test again** - login should work once Lambda is functioning
