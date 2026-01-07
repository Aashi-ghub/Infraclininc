# Lambda Handler Not Executing Fix

## Problem

After deployment, Lambda shows:
```
START RequestId: ...
END RequestId: ...
REPORT RequestId: ... Duration: 253.17 ms missing authentication
```

But the handler code never executes (no console.log output).

## Root Cause

The Lambda is starting but the handler function isn't being called. This usually means:

1. **Module loading error** - An import is failing silently
2. **Handler path mismatch** - The handler path doesn't match the export
3. **Syntax error** - There's a syntax error preventing the module from loading

## Solution

### Step 1: Add Module-Level Error Handler

Add this at the very top of `backend/src/handlers/auth.ts`:

```typescript
// Add at the very top, before any imports
process.on('uncaughtException', (error) => {
  console.error('[MODULE ERROR] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[MODULE ERROR] Unhandled rejection:', reason);
});
```

### Step 2: Verify Handler Export

The handler should be exported as:
```typescript
export const login = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // ...
};
```

And in `serverless.ts`:
```typescript
handler: 'src/handlers/auth.login'
```

### Step 3: Check for Import Errors

The most common cause is a missing dependency. Check if all imports are available:

```typescript
// These should all work:
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'; // ✅ Built-in
import { logger, logRequest, logResponse } from '../utils/logger'; // ✅ Check winston
import { createResponse } from '../types/common'; // ✅ Should work
import { z } from 'zod'; // ✅ Check if zod is in package.json
import * as authService from '../auth/authService'; // ✅ Check this file exists
```

### Step 4: Test with Minimal Handler

Temporarily replace the login handler with a minimal version to test:

```typescript
export const login = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('[TEST] Handler called');
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ message: 'Test successful' })
  };
};
```

If this works, the issue is in the handler code. If it doesn't, the issue is with the handler path or module loading.

## Quick Diagnostic

1. **Check CloudWatch Logs for errors**:
   ```bash
   aws logs tail /aws/lambda/backendbore-dev-login --follow
   ```

2. **Test Lambda directly in AWS Console**:
   - Go to Lambda → `backendbore-dev-login`
   - Test tab → Create test event
   - Run test
   - Check for errors in execution result

3. **Verify handler path**:
   - Lambda Console → Code tab
   - Check "Handler" field should be: `src/handlers/auth.login`

## Most Likely Issues

### Issue 1: Missing Dependency
**Symptom**: Handler doesn't execute, no errors  
**Fix**: Check `package.json` for all dependencies, especially:
- `winston` (for logger)
- `zod` (for validation)
- `jsonwebtoken` (for auth)
- `bcryptjs` (for password hashing)

### Issue 2: Handler Path Wrong
**Symptom**: Handler doesn't execute  
**Fix**: Verify handler path in `serverless.ts` matches export

### Issue 3: Module Import Error
**Symptom**: Handler doesn't execute  
**Fix**: Check all imports, especially `authService` and `userStore`

## Next Steps

1. Add error handlers at module level
2. Deploy and check CloudWatch logs for errors
3. Test with minimal handler to isolate the issue
4. Check all dependencies are in `package.json`
5. Verify handler path matches export
