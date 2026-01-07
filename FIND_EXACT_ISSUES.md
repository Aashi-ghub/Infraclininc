# How to Find Exact Issues - Step by Step

## Current Error
```
Runtime.ImportModuleError: Error: Cannot find module 'aws-sdk'
Require stack: /var/task/src/handlers/auth.js
```

This means the bundled code is trying to require 'aws-sdk' but it's not in the Lambda package.

## Diagnostic Steps

### Step 1: Verify package.json
```bash
cd backend
cat package.json | grep "aws-sdk"
```

**Expected**: Should show `"aws-sdk": "^2.1691.0"` in dependencies

### Step 2: Verify node_modules
```bash
cd backend
ls node_modules/aws-sdk  # Linux/Mac
dir node_modules\aws-sdk  # Windows
```

**Expected**: Directory should exist

**If missing**: Run `npm install`

### Step 3: Verify serverless.ts external config
```bash
cd backend
grep -A 5 "external:" serverless.ts
```

**Expected**: Should NOT include `'aws-sdk'` in the external array

**Current should be**:
```typescript
external: [
  'pg-native',
  '@aws-sdk/*'
  // aws-sdk should NOT be here
]
```

### Step 4: Check if npm install was run
```bash
cd backend
ls package-lock.json  # Check if exists
grep -A 2 '"aws-sdk"' package-lock.json  # Check if aws-sdk is locked
```

**If package-lock.json doesn't have aws-sdk**: Run `npm install`

### Step 5: Check deployment package
After deployment, check what was actually deployed:

```bash
# Check Lambda function code size
aws lambda get-function --function-name backendbore-dev-login --query 'Configuration.CodeSize'

# If code size is small (< 1MB), aws-sdk might not be bundled
```

### Step 6: Run the diagnostic script
```bash
cd backend
node diagnose-module-errors.js
```

This will check all the above automatically.

## Most Likely Issues

### Issue 1: npm install not run
**Symptom**: `aws-sdk` in package.json but not in node_modules  
**Fix**: `cd backend && npm install`

### Issue 2: Deployment didn't pick up changes
**Symptom**: Code deployed but still getting error  
**Fix**: 
1. Clean build: `rm -rf .serverless node_modules/.cache`
2. Reinstall: `npm install`
3. Redeploy: `serverless deploy`

### Issue 3: Cached build
**Symptom**: Changes made but deployment uses old code  
**Fix**: 
1. Delete `.serverless` folder
2. Redeploy: `serverless deploy --force`

### Issue 4: aws-sdk still in external (if you reverted changes)
**Symptom**: Error persists after npm install  
**Fix**: Remove `'aws-sdk'` from external array in serverless.ts

## Quick Fix Commands

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Verify aws-sdk is installed
ls node_modules/aws-sdk

# 3. Clean build cache
rm -rf .serverless
# Windows: rmdir /s /q .serverless

# 4. Deploy
serverless deploy
```

## Verify After Deployment

```bash
# Check latest logs
aws logs tail /aws/lambda/backendbore-dev-login --since 5m

# Look for:
# ✅ No "Cannot find module 'aws-sdk'" errors
# ✅ Should see "[AUTH HANDLER] Login handler called" log
```

## Expected Success Indicators

After successful deployment:
1. ✅ CloudWatch logs show handler executing
2. ✅ No `Runtime.ImportModuleError`
3. ✅ Login endpoint returns 200/400/401 (not 502)
4. ✅ CORS headers present in response
