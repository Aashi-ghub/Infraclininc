# AWS SDK v2 Fix

## Problem

Lambda is failing with:
```
Runtime.ImportModuleError: Error: Cannot find module 'aws-sdk'
```

## Root Cause

The code uses `aws-sdk` v2 in:
- `backend/src/utils/secrets.ts` - for SecretsManager
- `backend/src/services/parquetService.ts` - for Lambda client
- `backend/src/handlers/saveStratumData.ts` - for Lambda client

But:
1. `aws-sdk` was NOT in `package.json`
2. It was marked as `external` in `serverless.ts` (so esbuild wouldn't bundle it)
3. Node.js 18 Lambda runtime doesn't include `aws-sdk` v2 by default

## Solution

1. **Added `aws-sdk` to `package.json`**:
   ```json
   "aws-sdk": "^2.1691.0"
   ```

2. **Removed `aws-sdk` from external list** in `serverless.ts`:
   ```typescript
   external: [
     'pg-native',
     '@aws-sdk/*'
     // 'aws-sdk' removed - now it will be bundled
   ]
   ```

3. **Also added `@aws-sdk/client-lambda`** for future migration to v3

## Next Steps

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Deploy**:
   ```bash
   serverless deploy
   ```

## Future Improvement

Consider migrating to AWS SDK v3:
- `aws-sdk` SecretsManager → `@aws-sdk/client-secrets-manager` ✅ (already in package.json)
- `aws-sdk` Lambda → `@aws-sdk/client-lambda` ✅ (just added)

This will reduce bundle size and improve performance.
