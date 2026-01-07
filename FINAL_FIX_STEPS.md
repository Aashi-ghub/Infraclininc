# Final Fix Steps - aws-sdk Module Error

## Exact Issue Found

The diagnostic revealed:
- ✅ `aws-sdk` in package.json: YES
- ✅ `aws-sdk` in node_modules: YES (version 2.1693.0)
- ✅ `aws-sdk` NOT in external list: YES
- ❌ `aws-sdk` in package-lock.json: **NO** (This is the problem!)

## Root Cause

Even though `aws-sdk` is in `package.json` and installed in `node_modules`, it's **not in `package-lock.json`**. This means:
1. Serverless Framework/esbuild might not recognize it as a dependency
2. The bundler might skip it during the build process
3. The deployment package doesn't include it

## Solution

### Step 1: Update package-lock.json
```powershell
cd backend
npm install
```

This should add `aws-sdk` to `package-lock.json`.

### Step 2: Clean Build Cache
```powershell
Remove-Item -Recurse -Force .serverless
```

### Step 3: Verify package-lock.json
```powershell
Select-String -Path package-lock.json -Pattern '"aws-sdk"' | Select-Object -First 1
```

Should show `aws-sdk` entry.

### Step 4: Deploy
```powershell
serverless deploy
```

## Alternative: Force Reinstall

If `npm install` doesn't update package-lock.json:

```powershell
cd backend
Remove-Item package-lock.json
npm install
```

This will regenerate `package-lock.json` with all current dependencies.

## Verification After Deployment

```powershell
# Check logs - should NOT see "Cannot find module 'aws-sdk'"
aws logs tail /aws/lambda/backendbore-dev-login --since 5m

# Should see:
# ✅ "[AUTH HANDLER] Login handler called" 
# ✅ No Runtime.ImportModuleError
```

## Why This Happens

When you manually add a dependency to `package.json` without running `npm install`, it doesn't get added to `package-lock.json`. Serverless Framework uses `package-lock.json` to determine what to bundle, so missing entries cause bundling issues.
