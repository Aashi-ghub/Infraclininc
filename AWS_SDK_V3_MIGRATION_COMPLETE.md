# AWS SDK v3 Migration Complete

## Changes Made

Migrated from `aws-sdk` v2 to `@aws-sdk/*` v3 in three files:

### 1. `backend/src/utils/secrets.ts`
- **Before**: `import { SecretsManager } from 'aws-sdk';`
- **After**: `import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';`
- **Changes**:
  - Replaced `new SecretsManager()` with `new SecretsManagerClient({ region: ... })`
  - Replaced `.getSecretValue().promise()` with `send(new GetSecretValueCommand(...))`

### 2. `backend/src/services/parquetService.ts`
- **Before**: `import { Lambda } from 'aws-sdk';`
- **After**: `import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';`
- **Changes**:
  - Replaced `new Lambda()` with `new LambdaClient({ region: ... })`
  - Replaced `.invoke().promise()` with `send(new InvokeCommand(...))`
  - Added Uint8Array decoding for `result.Payload` (v3 returns binary)

### 3. `backend/src/handlers/saveStratumData.ts`
- **Before**: `import { Lambda } from 'aws-sdk';`
- **After**: `import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';`
- **Changes**:
  - Same as parquetService.ts
  - Updated `invokeStratumLambda` function to use v3 API

## Why This Fixes the Issue

1. **Node.js 18 Compatibility**: AWS SDK v3 is the recommended SDK for Node.js 18 Lambda runtime
2. **Smaller Bundle**: AWS SDK v3 is modular - only includes what you use
3. **Already in package.json**: `@aws-sdk/client-secrets-manager` and `@aws-sdk/client-lambda` are already dependencies
4. **No External Config Needed**: Since we're using v3, it's already in the external list (`@aws-sdk/*`), which is correct

## Next Steps

1. **Deploy**:
   ```powershell
   cd backend
   serverless deploy
   ```

2. **Verify**:
   - Check CloudWatch logs - should NOT see `Runtime.ImportModuleError`
   - Test login endpoint - should work
   - Function size should be reasonable (not 40MB+)

## Benefits

- ✅ No more `aws-sdk` v2 dependency needed
- ✅ Smaller bundle size (modular imports)
- ✅ Better performance (v3 is faster)
- ✅ Future-proof (v2 is deprecated)
- ✅ Proper Node.js 18 support
