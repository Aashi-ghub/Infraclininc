# Temporary Authentication & Authorization Module

## Overview

This is a **TEMPORARY** authentication system designed to be easily replaced with AWS Cognito. The system uses a static JSON file for user storage and is **NOT** suitable for production use.

## ⚠️ Important Notes

- **TEMPORARY**: This system is for development/demo purposes only
- **NO DATABASE**: Users are stored in `users.json` file
- **NO S3**: User data is completely separate from project/borelog data
- **MIGRATION-FRIENDLY**: Designed for easy Cognito migration

## Architecture

### Components

1. **`users.json`** - Static user storage (loaded at startup)
2. **`userStore.ts`** - User storage abstraction layer
3. **`authService.ts`** - Authentication service (login, register, token generation)
4. **`handlers/auth.ts`** - API handlers (uses authService)

### Design Principles

- **Separation of Concerns**: Auth logic is separate from business logic
- **Interface-Based**: Easy to swap implementations
- **No Tight Coupling**: Auth doesn't depend on borelog/project logic
- **Cognito-Ready**: Interface designed to match Cognito patterns

## User Storage

### File: `auth/users.json`

```json
[
  {
    "id": "u_admin",
    "email": "admin@backendbore.com",
    "password": "admin123",
    "role": "Admin",
    "name": "Admin User"
  }
]
```

### Default Users

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@backendbore.com | admin123 |
| Project Manager | pm@backendbore.com | pm123 |
| Site Engineer | site@backendbore.com | site123 |
| Approval Engineer | approval@backendbore.com | approval123 |
| Lab Engineer | lab@backendbore.com | lab123 |
| Customer | customer@backendbore.com | customer123 |

**⚠️ Change these passwords before deploying!**

## API Endpoints

### Login
```
POST /auth/login
Body: { email: string, password: string }
Response: { token: string, user: {...} }
```

### Register (for demo/admin)
```
POST /auth/register
Body: { email: string, password: string, name: string, role: UserRole }
Response: { token: string, user: {...} }
```

### Get Current User
```
GET /auth/me
Headers: Authorization: Bearer <token>
Response: { user: {...} }
```

## Role-Based Access Control

Roles are enforced in API routes using the `checkRole` middleware:

```typescript
import { checkRole } from '../utils/validateInput';

export const handler = async (event: APIGatewayProxyEvent) => {
  const roleCheck = await checkRole(['Admin', 'Project Manager'])(event);
  if (roleCheck) return roleCheck; // Returns error if unauthorized
  
  // Handler logic here
};
```

## Migration to Cognito

### Step 1: Create Cognito User Pool

1. Create AWS Cognito User Pool
2. Configure authentication settings
3. Set up user attributes (email, name, custom:role)

### Step 2: Replace User Store

Create `src/auth/cognitoUserStore.ts`:

```typescript
import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';

export async function findUserByEmail(email: string) {
  // Use Cognito AdminGetUser API
}

export async function addUser(user: User) {
  // Use Cognito AdminCreateUser API
}
```

### Step 3: Update Auth Service

Replace password comparison with Cognito authentication:

```typescript
import { InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';

export async function login(credentials: LoginCredentials) {
  // Use Cognito InitiateAuth API
  // Return Cognito tokens (ID token, Access token)
}
```

### Step 4: Update Token Validation

Cognito tokens can be validated using:
- AWS SDK `VerifyTokenCommand`
- Or JWT verification with Cognito public keys

### Step 5: Remove JSON File

Once Cognito is integrated:
1. Delete `auth/users.json`
2. Remove `userStore.ts` file-based implementation
3. Update imports to use Cognito implementation

## Security Considerations

### Current (Temporary) System

- ✅ Passwords are hashed using bcrypt
- ✅ JWT tokens expire after 24 hours
- ✅ Role-based access control enforced
- ⚠️ User data stored in plain JSON file
- ⚠️ No password reset functionality
- ⚠️ No MFA support

### After Cognito Migration

- ✅ AWS-managed user storage
- ✅ Built-in password policies
- ✅ Password reset flows
- ✅ MFA support
- ✅ User pool federation
- ✅ Advanced security features

## Testing

### Manual Testing

```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@backendbore.com","password":"admin123"}'

# Get current user
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer <token>"
```

## File Structure

```
backend/
├── auth/
│   ├── users.json          # Static user storage (TEMPORARY)
│   └── README.md           # This file
└── src/
    ├── auth/
    │   ├── userStore.ts    # User storage abstraction
    │   └── authService.ts  # Authentication service
    ├── handlers/
    │   └── auth.ts         # API handlers
    └── utils/
        └── validateInput.ts # Token validation & RBAC
```

## Notes

- All auth logic is isolated in the `auth` module
- No database queries in auth handlers
- No S3 operations for user data
- Clean separation allows easy Cognito migration
- Same API interface maintained for frontend compatibility


