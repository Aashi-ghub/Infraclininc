# Deployment Checklist - Fix aws-sdk Error

## ✅ Pre-Deployment Verification

Run this to verify everything is ready:

```powershell
cd backend
node diagnose-module-errors.js
```

**All should show ✅**:
- [x] aws-sdk in package.json
- [x] aws-sdk in node_modules  
- [x] aws-sdk NOT in external list
- [x] aws-sdk in package-lock.json

## 🧹 Clean Build (REQUIRED)

```powershell
cd backend

# Remove build cache
Remove-Item -Recurse -Force .serverless -ErrorAction SilentlyContinue

# Remove npm cache (optional but recommended)
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue

Write-Host "✅ Build cache cleaned"
```

## 📦 Verify Dependencies

```powershell
# Verify aws-sdk is installed
Test-Path node_modules\aws-sdk

# Should return: True

# Verify package-lock.json has aws-sdk
Select-String -Path package-lock.json -Pattern '"aws-sdk"' | Select-Object -First 1

# Should show: "aws-sdk": "^2.1691.0"
```

## 🚀 Deploy

```powershell
serverless deploy
```

**Wait for completion** - This can take 5-10 minutes.

## ✅ Post-Deployment Verification

### 1. Check CloudWatch Logs
```powershell
aws logs tail /aws/lambda/backendbore-dev-login --since 5m
```

**Should see**:
- ✅ `[AUTH HANDLER] Login handler called - START`
- ✅ No `Runtime.ImportModuleError`
- ✅ No `Cannot find module 'aws-sdk'`

### 2. Test Endpoint
```powershell
curl -X POST https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"test@test.com\",\"password\":\"test\"}' `
  -v
```

**Expected responses**:
- ✅ 200 OK (with valid credentials)
- ✅ 400 Bad Request (missing body)
- ✅ 401 Unauthorized (wrong credentials)
- ❌ NOT 502 Bad Gateway
- ❌ NOT "Missing Authentication Token"

### 3. Check Response Headers
The response should include CORS headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With`
- `Access-Control-Allow-Credentials: true`

## 🔍 If Still Failing

### Check Lambda Code Size
```powershell
aws lambda get-function --function-name backendbore-dev-login --query 'Configuration.CodeSize'
```

- **If < 1MB**: aws-sdk might not be bundled (too small)
- **If > 10MB**: Should be fine, aws-sdk is bundled

### Check Deployment Output
Look for in deployment output:
```
Packaging service...
Bundling with esbuild...
```

Should show bundling process.

### Force Clean Rebuild
```powershell
cd backend
Remove-Item -Recurse -Force .serverless
Remove-Item -Recurse -Force node_modules
npm install
serverless deploy
```

## Common Issues

### Issue: "up to date" but still failing
**Cause**: package-lock.json not updated  
**Fix**: `Remove-Item package-lock.json && npm install`

### Issue: Deployment succeeds but Lambda fails
**Cause**: Old code cached in Lambda  
**Fix**: Wait 30 seconds, test again, or force update

### Issue: Bundle too large
**Cause**: aws-sdk is ~40MB  
**Fix**: Consider migrating to @aws-sdk v3 (smaller)

## Success Criteria

After deployment, you should have:
1. ✅ No `Runtime.ImportModuleError` in logs
2. ✅ Handler executes (see console.log output)
3. ✅ Login endpoint returns proper HTTP status codes
4. ✅ CORS headers present in responses
5. ✅ No 502 Bad Gateway errors
