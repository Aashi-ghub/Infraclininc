# Deployment Endpoints Quick Reference

## 🌐 Production URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | `https://dwodlititlpa1.cloudfront.net/` | Static React SPA |
| **Backend (Main)** | `https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/` | Core API (auth, projects, borelogs) |
| **Backend-Ops** | `https://uby3f1n6zi.execute-api.us-east-1.amazonaws.com/dev/` | Lab reports & workflow |

---

## 🔀 Routing Rules

### → Backend-Ops (`uby3f1n6zi...`)

| Path Prefix | Example Endpoints |
|------------|------------------|
| `/lab-reports` | `/lab-reports`, `/lab-reports/{id}/version/{v}` |
| `/lab` | `/lab/*` |
| `/workflow` | `/workflow/{id}/submit`, `/workflow/pending-reviews` |
| `/unified-lab-reports` | `/unified-lab-reports`, `/unified-lab-reports/{id}` |
| `/pending-csv-uploads` | `/pending-csv-uploads`, `/pending-csv-uploads/{id}/approve` |
| `/lab-requests` | `/lab-requests`, `/lab-requests/{id}` |
| `/lab-tests` | `/lab-tests`, `/lab-tests/{id}` |
| `/anomalies` | `/anomalies`, `/anomalies/{id}` |
| `/contacts` | `/contacts`, `/contacts/{id}` |

### → Backend (Main) (`451vcfv074...`)

| Path Prefix | Example Endpoints |
|------------|------------------|
| `/auth` | `/auth/login`, `/auth/me` |
| `/users` | `/users`, `/users/{id}`, `/users/lab-engineers` |
| `/projects` | `/projects`, `/projects/{id}`, `/projects/{id}/borelogs` |
| `/structures` | `/structures`, `/structures/{id}` |
| `/substructures` | `/substructures`, `/substructures/{id}` |
| `/borelog` | `/borelog`, `/borelog/{id}`, `/borelog/{id}/approve` |
| `/borelog-details` | `/borelog-details`, `/borelog-details/{borelogId}` |
| `/borelog-assignments` | `/borelog-assignments`, `/borelog-assignments/borelog/{id}` |
| `/borelog-images` | `/borelog-images`, `/borelog-images/{borelogId}` |
| `/boreholes` | `/boreholes`, `/boreholes/{id}` |
| `/geological-log` | `/geological-log`, `/geological-log/{id}` |
| `/assignments` | `/assignments` |
| `/stratum-data` | `/stratum-data` |
| `/borelog-form-data` | `/borelog-form-data` |
| **Default** | All other paths |

---

## 🧪 Quick Test Commands

### Test Frontend
```bash
curl -I https://dwodlititlpa1.cloudfront.net/
```

### Test Backend (Main) - Auth
```bash
curl -X POST https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

### Test Backend-Ops - Lab Reports
```bash
curl -X GET https://uby3f1n6zi.execute-api.us-east-1.amazonaws.com/dev/lab-reports \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔍 Browser Console Verification

Open DevTools Console on `https://dwodlititlpa1.cloudfront.net/` and check:

1. **Initial Load**:
   ```
   [API Router] Production mode - Routing enabled
   ```

2. **Network Tab**:
   - Filter by `451vcfv074` → Should see: auth, users, projects, borelogs
   - Filter by `uby3f1n6zi` → Should see: lab-reports, workflow, lab-tests

---

## ⚙️ Configuration Files

- **Router**: `frontend/src/lib/apiRouter.ts`
- **API Client**: `frontend/src/lib/api.ts`
- **Production Detection**: Automatic (based on hostname + HTTPS)

---

**Note**: All routing is automatic. No environment variables needed for production deployment.
