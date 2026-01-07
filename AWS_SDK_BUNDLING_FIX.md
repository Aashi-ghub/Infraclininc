# AWS SDK Bundling Fix - Final Solution

## Problem

Even after:
- ✅ Adding `aws-sdk` to `package.json`
- ✅ Removing `aws-sdk` from `external` list
- ✅ Cleaning build cache
- ✅ Deploying with `--force`

The Lambda function is still **167 kB** (too small - aws-sdk is ~40MB), and we get:
```
Runtime.ImportModuleError: Error: Cannot find module 'aws-sdk'
```

## Root Cause

**Node.js 18 Lambda runtime does NOT include `aws-sdk` v2 by default** (only Node.js 12 had it).

The issue is that `serverless-esbuild` might be:
1. Excluding `aws-sdk` by default (even though it's not in external)
2. Not bundling large dependencies properly
3. Tree-shaking it away

## Solution Options

### Option 1: Force Bundle aws-sdk (Recommended for Quick Fix)

Add explicit configuration to force bundling:

```typescript
// backend/serverless.ts
custom: {
  esbuild: {
    bundle: true,
    minify: false,
    sourcemap: false,
    target: 'node18',
    define: { 'require.resolve': undefined },
    platform: 'node',
    concurrency: 3,
    external: [
      'pg-native',
      '@aws-sdk/*'
      // aws-sdk is NOT here - should be bundled
    ],
    keepNames: true,
    // Force include aws-sdk
    exclude: [],  // Explicitly set to empty array
    packagerOptions: {
      scripts: []
    }
  }
}
```

### Option 2: Migrate to AWS SDK v3 (Best Long-term Solution)

We already have `@aws-sdk/client-secrets-manager` in package.json. Migrate:

**In `backend/src/utils/secrets.ts`:**
```typescript
// OLD:
import { SecretsManager } from 'aws-sdk';

// NEW:
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
```

**In `backend/src/services/parquetService.ts`:**
```typescript
// OLD:
import { Lambda } from 'aws-sdk';

// NEW:
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
```

**In `backend/src/handlers/saveStratumData.ts`:**
```typescript
// OLD:
import { Lambda } from 'aws-sdk';

// NEW:
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
```

### Option 3: Use Lambda Layer (Alternative)

Package `aws-sdk` in a Lambda Layer and reference it in the function.

## Immediate Fix Steps

1. **Verify aws-sdk is installed:**
   ```powershell
   cd backend
   Test-Path node_modules\aws-sdk
   ```

2. **Check if serverless-esbuild has exclude defaults:**
   - Look for any `exclude` configuration
   - Check if `package.patterns` is excluding node_modules

3. **Try explicit include:**
   Add to `serverless.ts`:
   ```typescript
   package: {
     individually: true,
     patterns: [
       '!node_modules/@aws-sdk/**',  // Exclude v3 (external)
       '!node_modules/**',            // Exclude all node_modules
       // But aws-sdk should be bundled by esbuild, not in node_modules
     ]
   }
   ```

4. **Force clean rebuild:**
   ```powershell
   cd backend
   Remove-Item -Recurse -Force .serverless
   Remove-Item -Recurse -Force node_modules
   npm install
   serverless package  # Just package, don't deploy
   ```

5. **Check bundle size:**
   ```powershell
   # Should be > 40MB if aws-sdk is bundled
   (Get-Item .serverless\backendbore-dev-login.zip).Length / 1MB
   ```

## Why This Happens

- **Node.js 18**: Does NOT include aws-sdk v2
- **serverless-esbuild**: May have default excludes for large packages
- **esbuild**: May tree-shake unused imports
- **Bundle size**: 167 kB confirms aws-sdk is NOT bundled

## Recommended Action

**Migrate to AWS SDK v3** - it's already in package.json, smaller, and the proper solution for Node.js 18.
