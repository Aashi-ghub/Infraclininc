# AWS SDK Module Error Fix

## Problem

Lambda function was failing with:
```
Runtime.ImportModuleError: Error: Cannot find module 'aws-sdk'
```

## Root Cause

The code uses `aws-sdk` (AWS SDK v2) in:
- `backend/src/utils/secrets.ts` - for SecretsManager
- `backend/src/services/parquetService.ts` - for Lambda client
- `backend/src/handlers/saveStratumData.ts` - for Lambda client

When using `serverless-esbuild` with bundling, esbuild tries to bundle `aws-sdk`, but it needs to be marked as external so it uses the version available in the Lambda runtime.

## Solution

Added `aws-sdk` to the `external` list in both `serverless.ts` files:

### backend/serverless.ts
```typescript
external: [
  'pg-native',
  'jsonwebtoken',
  '@aws-sdk/*',
  'aws-sdk'  // ← Added this
],
```

### backendbore-ops/serverless.ts
```typescript
external: [
  'pg-native',
  'jsonwebtoken',
  '@aws-sdk/*',
  'aws-sdk'  // ← Added this
],
```

## Why This Works

- AWS Lambda Node.js 18 runtime includes `aws-sdk` v2 by default
- By marking it as `external`, esbuild won't try to bundle it
- Lambda will use the runtime's built-in `aws-sdk` module

## Next Steps

1. **Deploy both services**:
   ```bash
   cd backend
   serverless deploy
   
   cd ../backendbore-ops
   serverless deploy
   ```

2. **Test the login endpoint** - it should now work!

3. **Verify in CloudWatch Logs** - you should see the Lambda executing successfully

## Alternative: Migrate to AWS SDK v3 (Future Improvement)

For better performance and smaller bundle sizes, consider migrating to AWS SDK v3:
- `aws-sdk` → `@aws-sdk/client-secrets-manager`
- `aws-sdk` Lambda → `@aws-sdk/client-lambda`

But for now, using the external `aws-sdk` is the quickest fix.
