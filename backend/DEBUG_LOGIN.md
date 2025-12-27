# Login Debugging Guide

## Quick Test

Try logging in with:
- **Email**: `admin@backendbore.com`
- **Password**: `admin123` (no space, all lowercase)

## Common Issues

### 1. Password Typo
- ❌ Wrong: `admin 123` (with space)
- ❌ Wrong: `Admin123` (capital A)
- ✅ Correct: `admin123` (all lowercase, no space)

### 2. Backend Not Running
Make sure the backend is running:
```bash
cd backendbore/backend
npm run dev
```

You should see:
```
Serverless: Starting Offline...
```

### 3. Check Backend Logs
When you try to login, check the backend console for:
- `[AUTH] Login attempt` - Should appear when request received
- `[AUTH] User found` - Should appear if user exists
- `[AUTH] Password mismatch` - Will show if password is wrong
- `[AUTH] Login successful` - Should appear on success

### 4. Verify Users File
The users file should be at:
```
backendbore/backend/auth/users.json
```

Admin user should have:
- Email: `admin@backendbore.com`
- Password: `admin123`
- Role: `Admin`

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@backendbore.com | admin123 |
| Project Manager | pm@backendbore.com | pm123 |
| Site Engineer | site@backendbore.com | site123 |
| Approval Engineer | approval@backendbore.com | approval123 |
| Lab Engineer | lab@backendbore.com | lab123 |
| Customer | customer@backendbore.com | customer123 |

## API Endpoint

Login endpoint: `POST http://localhost:3000/auth/login`

Request body:
```json
{
  "email": "admin@backendbore.com",
  "password": "admin123"
}
```

Expected response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "<jwt-token>",
    "user": {
      "id": "u_admin",
      "email": "admin@backendbore.com",
      "name": "Admin User",
      "role": "Admin"
    }
  }
}
```

## Troubleshooting Steps

1. **Check backend is running**: Look for serverless offline output
2. **Check browser console**: Look for network errors
3. **Check backend logs**: Look for `[AUTH]` prefixed messages
4. **Verify password**: Make sure no extra spaces or capitalization
5. **Clear browser cache**: Try incognito/private window
6. **Check API URL**: Frontend should point to `http://localhost:3000`










