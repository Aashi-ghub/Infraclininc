# Deployment Verification Guide

## 🚀 Production Deployment URLs

### Frontend (Static)
- **URL**: https://dwodlititlpa1.cloudfront.net/
- **Type**: CloudFront Distribution (Static SPA)

### Backend (Main API)
- **URL**: https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/
- **Type**: AWS API Gateway
- **Routes**: All non-lab/workflow endpoints

### Backend-Ops (Lab Reports & Workflow)
- **URL**: https://uby3f1n6zi.execute-api.us-east-1.amazonaws.com/dev/
- **Type**: AWS API Gateway
- **Routes**: Lab, workflow, and related endpoints

---

## 📋 API Routing Configuration

### Routes to Backend-Ops (`/dev/` on backend-ops API Gateway)

The following path prefixes automatically route to **Backend-Ops**:
- `/lab-reports/*` - Lab report management
- `/lab/*` - Lab operations
- `/workflow/*` - Workflow management
- `/unified-lab-reports/*` - Unified lab reports
- `/pending-csv-uploads/*` - CSV upload approvals
- `/lab-requests/*` - Lab request management
- `/lab-tests/*` - Lab test operations
- `/anomalies/*` - Anomaly management
- `/contacts/*` - Contact management

**Example**: 
- Request: `/lab-reports/123/version/1`
- Routed to: `https://uby3f1n6zi.execute-api.us-east-1.amazonaws.com/dev/lab-reports/123/version/1`

### Routes to Backend (Main) (`/dev/` on main API Gateway)

All other endpoints route to **Backend (Main)**, including:
- `/auth/*` - Authentication
- `/users/*` - User management
- `/projects/*` - Project management
- `/structures/*` - Structure management
- `/substructures/*` - Substructure management
- `/borelogs/*` - Borelog operations
- `/borelog/*` - Borelog operations
- `/borelog-details/*` - Borelog details
- `/borelog-assignments/*` - Borelog assignments
- `/borelog-images/*` - Borelog images
- `/boreholes/*` - Borehole management
- `/geological-log/*` - Geological logging
- `/assignments/*` - User assignments
- `/stratum-data/*` - Stratum data
- `/borelog-form-data` - Form data

**Example**:
- Request: `/auth/login`
- Routed to: `https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login`

---

## ✅ Pre-Deployment Checklist

### 1. Code Verification
- [x] API Router implemented (`frontend/src/lib/apiRouter.ts`)
- [x] All hardcoded `baseURL` removed from API calls
- [x] Production detection logic working
- [x] Environment detection (production vs local) configured

### 2. Production Detection
The system automatically detects production when:
- Hostname is NOT `localhost` or `127.0.0.1`
- Protocol is `https:`
- This ensures CloudFront deployments use production URLs

### 3. CORS Configuration
Ensure both API Gateways have CORS configured to allow:
- **Origin**: `https://dwodlititlpa1.cloudfront.net`
- **Methods**: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- **Headers**: `Content-Type, Authorization`
- **Credentials**: `true` (if using cookies/auth tokens)

### 4. API Gateway Configuration
Verify both API Gateways:
- [ ] CORS enabled for CloudFront origin
- [ ] Authentication/authorization configured
- [ ] Rate limiting configured (if needed)
- [ ] CloudWatch logging enabled
- [ ] Error responses properly formatted

---

## 🧪 Post-Deployment Testing

### 1. Frontend Access
```bash
# Open in browser
https://dwodlititlpa1.cloudfront.net/
```

### 2. Test Backend (Main) Endpoints

Open browser console and verify routing:

**Authentication**:
```javascript
// Should route to: https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login
fetch('https://dwodlititlpa1.cloudfront.net/')
  .then(() => console.log('Frontend loaded'))
```

**Projects**:
- Navigate to Projects page
- Check Network tab: requests should go to `451vcfv074.execute-api.us-east-1.amazonaws.com`

**Borelogs**:
- Navigate to Borelogs page
- Check Network tab: requests should go to `451vcfv074.execute-api.us-east-1.amazonaws.com`

### 3. Test Backend-Ops Endpoints

**Lab Reports**:
- Navigate to Lab Reports page
- Check Network tab: requests should go to `uby3f1n6zi.execute-api.us-east-1.amazonaws.com`

**Workflow**:
- Navigate to Workflow/Review pages
- Check Network tab: requests should go to `uby3f1n6zi.execute-api.us-east-1.amazonaws.com`

**Lab Tests**:
- Navigate to Lab Tests page
- Check Network tab: requests should go to `uby3f1n6zi.execute-api.us-east-1.amazonaws.com`

### 4. Console Verification

Open browser DevTools Console. You should see:
```
[API Router] Production mode - Routing enabled
{
  hostname: "dwodlititlpa1.cloudfront.net",
  backendBase: "https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev",
  backendOpsBase: "https://uby3f1n6zi.execute-api.us-east-1.amazonaws.com/dev"
}
```

### 5. Network Request Verification

In DevTools Network tab, verify:
- ✅ All `/auth/*`, `/users/*`, `/projects/*`, `/borelogs/*` requests go to `451vcfv074...`
- ✅ All `/lab-reports/*`, `/workflow/*`, `/lab-tests/*` requests go to `uby3f1n6zi...`
- ✅ No CORS errors
- ✅ All requests return 200/201/204 or appropriate status codes
- ✅ Authentication tokens are included in headers

---

## 🔍 Endpoint Testing Checklist

### Backend (Main) - `451vcfv074.execute-api.us-east-1.amazonaws.com/dev`

#### Authentication
- [ ] `POST /auth/login` - User login
- [ ] `GET /auth/me` - Get current user

#### Users
- [ ] `GET /users` - List users
- [ ] `GET /users/{id}` - Get user by ID
- [ ] `GET /users/lab-engineers` - Get lab engineers

#### Projects
- [ ] `GET /projects` - List projects
- [ ] `GET /projects/{id}` - Get project by ID
- [ ] `POST /projects` - Create project

#### Structures
- [ ] `GET /structures?project_id={id}` - List structures
- [ ] `POST /structures` - Create structure
- [ ] `GET /structures/{id}` - Get structure by ID
- [ ] `PUT /structures/{id}` - Update structure

#### Substructures
- [ ] `GET /substructures?project_id={id}` - List substructures
- [ ] `POST /substructures` - Create substructure
- [ ] `GET /substructures/{id}` - Get substructure by ID

#### Borelogs
- [ ] `POST /borelog` - Create borelog
- [ ] `GET /borelog/{id}` - Get borelog by ID
- [ ] `GET /projects/{id}/borelogs` - Get borelogs by project
- [ ] `POST /borelog/{id}/approve` - Approve borelog
- [ ] `POST /borelog/upload-csv` - Upload CSV
- [ ] `GET /borelog-form-data` - Get form data

#### Borelog Details
- [ ] `POST /borelog-details` - Create borelog details
- [ ] `GET /borelog-details/{borelogId}` - Get details by borelog

#### Boreholes
- [ ] `GET /boreholes` - List boreholes
- [ ] `GET /boreholes/{id}` - Get borehole by ID
- [ ] `POST /boreholes` - Create borehole
- [ ] `PUT /boreholes/{id}` - Update borehole

### Backend-Ops - `uby3f1n6zi.execute-api.us-east-1.amazonaws.com/dev`

#### Lab Reports
- [ ] `GET /lab-reports` - List lab reports
- [ ] `GET /lab-reports/{id}` - Get lab report by ID
- [ ] `POST /lab-reports` - Create lab report
- [ ] `PUT /lab-reports/{id}` - Update lab report
- [ ] `GET /lab-reports/{id}/version/{versionNo}` - Get specific version
- [ ] `GET /lab-reports/{id}/versions` - Get version history

#### Lab Requests
- [ ] `GET /lab-requests` - List lab requests
- [ ] `GET /lab-requests/{id}` - Get lab request by ID
- [ ] `POST /lab-requests` - Create lab request
- [ ] `PUT /lab-requests/{id}` - Update lab request

#### Lab Tests
- [ ] `GET /lab-tests` - List lab tests
- [ ] `GET /lab-tests/{id}` - Get lab test by ID
- [ ] `POST /lab-tests` - Create lab test
- [ ] `GET /lab-tests/project/{projectId}` - Get tests by project

#### Workflow
- [ ] `POST /workflow/{borelogId}/submit` - Submit for review
- [ ] `POST /workflow/{borelogId}/review` - Review borelog
- [ ] `GET /workflow/{borelogId}/status` - Get workflow status
- [ ] `GET /workflow/pending-reviews` - Get pending reviews
- [ ] `GET /workflow/lab-assignments` - Get lab assignments
- [ ] `GET /workflow/statistics` - Get workflow statistics

#### Unified Lab Reports
- [ ] `GET /unified-lab-reports` - List unified reports
- [ ] `GET /unified-lab-reports/{id}` - Get unified report
- [ ] `POST /unified-lab-reports` - Create unified report
- [ ] `PUT /unified-lab-reports/{id}` - Update unified report
- [ ] `POST /unified-lab-reports/{id}/submit` - Submit for approval
- [ ] `POST /unified-lab-reports/upload-csv` - Upload CSV

#### Pending CSV Uploads
- [ ] `GET /pending-csv-uploads` - List pending uploads
- [ ] `GET /pending-csv-uploads/{id}` - Get pending upload
- [ ] `POST /pending-csv-uploads/{id}/approve` - Approve upload

---

## 🐛 Troubleshooting

### Issue: CORS Errors
**Solution**: Verify CORS configuration on both API Gateways allows:
- Origin: `https://dwodlititlpa1.cloudfront.net`
- Methods: All required HTTP methods
- Headers: `Content-Type, Authorization`

### Issue: Requests Going to Wrong Backend
**Solution**: 
1. Check browser console for routing logs
2. Verify path prefixes in `apiRouter.ts`
3. Clear browser cache and hard refresh

### Issue: 401 Unauthorized Errors
**Solution**:
1. Verify authentication token is being sent
2. Check token expiration
3. Verify API Gateway authorizers are configured

### Issue: 404 Not Found
**Solution**:
1. Verify API Gateway routes are deployed
2. Check path matches exactly (case-sensitive)
3. Verify `/dev` stage is correct

### Issue: Production Detection Not Working
**Solution**:
1. Check browser console for `[API Router]` logs
2. Verify hostname is not localhost
3. Verify protocol is `https:`
4. Check `apiRouter.ts` production detection logic

---

## 📝 Deployment Notes

### Environment Variables
For local development, set (optional):
- `VITE_API_BASE_URL` - Default: `http://localhost:3000/dev`
- `VITE_OPS_API_BASE_URL` - Default: `http://localhost:3005/dev`

For production, these are **NOT needed** - the router uses hardcoded production URLs.

### Build Process
```bash
cd frontend
npm install
npm run build
# Deploy dist/ folder to CloudFront
```

### Cache Invalidation
After deployment, invalidate CloudFront cache:
```bash
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/*"
```

---

## ✨ Success Criteria

Deployment is successful when:
- ✅ Frontend loads at CloudFront URL
- ✅ All API requests route to correct backends
- ✅ No CORS errors in console
- ✅ Authentication works
- ✅ All pages load without errors
- ✅ Data can be created/updated/deleted
- ✅ Lab reports workflow functions correctly
- ✅ Borelog operations work correctly

---

**Last Updated**: Deployment verification guide for production URLs
**Version**: 1.0
