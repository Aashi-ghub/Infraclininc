# PHASE 1 — PLANNING: Service Split Strategy

## Goal
Reduce CloudFormation resources in `backend` service below AWS limits (500 resources) by introducing a second service `backendbore-ops` that handles operational/administrative domains.

## Current State Analysis

### Total Handlers in Current Service: ~100+ Lambda Functions

Each Lambda function creates multiple CloudFormation resources:
- Lambda Function resource
- IAM Role for Lambda
- API Gateway Integration
- API Gateway Method
- API Gateway Resource (if new path)
- Log Group
- Potentially additional resources for timeouts, memory, etc.

**Estimated**: ~5-7 resources per handler = 500-700+ total resources (exceeding AWS limit)

## Handler Categorization

### ✅ **backend** (STAYS - Protected Domains, NO RENAMING)

**IMPORTANT**: The existing service remains named `backend` (NOT renamed to `backendbore-core`). Only handler definitions are removed from `backend/serverless.ts`.

These handlers MUST remain in `backend` as they are explicitly protected:

#### 1. **Auth Domain** (3 handlers)
- `login` - POST /auth/login
- `register` - POST /auth/register  
- `me` - GET /auth/me

#### 2. **Borelog Domain** (18 handlers) - ❌ DO NOT TOUCH
- `createBorelog` - POST /borelog
- `createBorelogDetails` - POST /borelog-details
- `createBorelogVersion` - POST /borelog/version
- `getBorelogBasicInfo` - GET /borelog/{borelog_id}
- `getBorelogDetailsByBorelogId` - GET /borelog-details/{borelog_id}
- `getBorelogBySubstructureId` - GET /borelog/substructure/{substructure_id}
- `getBorelogsByProject` - GET /projects/{project_id}/borelogs
- `deleteBorelog` - DELETE /borelog/{borelog_id}
- `listBorelogs` - GET /borelogs (alias)
- `approveBorelog` - POST /borelog/{borelog_id}/approve
- `uploadBorelogCSV` - POST /borelog/upload-csv
- `uploadBoreholeCsv` - POST /api/borelog/upload-csv
- `getBorelogFormData` - GET /borelog-form-data
- `submitBorelog` - POST /borelog/submit
- `getBorelogSubmissions` - GET /borelog/submissions/{projectId}/{boreholeId}
- `getBorelogSubmission` - GET /borelog/submission/{submissionId}
- `uploadBorelogImage` - POST /borelog-images
- `getBorelogImages` - GET /borelog-images/{borelog_id}
- `deleteBorelogImage` - DELETE /borelog-images/{image_id}

#### 3. **Borelog Assignments** (7 handlers) - Related to Borelog
- `createBorelogAssignment` - POST /borelog-assignments
- `updateBorelogAssignment` - PUT /borelog-assignments/{assignmentId}
- `getBorelogAssignmentsByBorelogId` - GET /borelog-assignments/borelog/{borelogId}
- `getBorelogAssignmentsByStructureId` - GET /borelog-assignments/structure/{structureId}
- `getBorelogAssignmentsBySiteEngineer` - GET /borelog-assignments/site-engineer/{siteEngineerId}
- `getActiveBorelogAssignments` - GET /borelog-assignments/active
- `deleteBorelogAssignment` - DELETE /borelog-assignments/{assignmentId}

#### 4. **Geological Log Domain** (7 handlers) - Related to Borelog
- `createGeologicalLog` - POST /geological-log
- `getGeologicalLogById` - GET /geological-log/{borelog_id}
- `updateGeologicalLog` - PUT /geological-log/{borelog_id}
- `deleteGeologicalLog` - DELETE /geological-log/{borelog_id}
- `listGeologicalLogs` - GET /geological-log
- `getGeologicalLogsByProjectName` - GET /geological-log/project-name/{project_name}
- `getGeologicalLogsByProjectNameWithSubstructures` - GET /geological-log/project-name/{project_name}/with-substructures
- `updateSubstructureAssignment` - PUT /geological-log/{borelog_id}/substructure

#### 5. **Project Domain** (3 handlers) - ❌ DO NOT TOUCH
- `listProjects` - GET /projects
- `getProject` - GET /projects/{project_id}
- `createProject` - POST /projects


#### 6. **Structure Domain** (3 handlers) - Related to Projects
- `listStructures` - GET /structures
- `createStructure` - POST /structures
- `getStructureById` - GET /structures/{structure_id}

#### 7. **Substructure Domain** (3 handlers) - ❌ DO NOT TOUCH
- `listSubstructures` - GET /substructures
- `createSubstructure` - POST /substructures
- `getSubstructureById` - GET /substructures/{substructure_id}

#### 8. **Stratum Data Domain** (2 handlers) - ❌ DO NOT TOUCH
- `saveStratumData` - POST /stratum-data
- `getStratumData` - GET /stratum-data

#### 9. **Boreholes Domain** (6 handlers) - Related to Borelog/Projects
- `listBoreholes` - GET /boreholes
- `getBoreholeById` - GET /boreholes/{boreholeId}
- `getBoreholesByProject` - GET /boreholes/project/{projectId}
- `getBoreholesByProjectAndStructure` - GET /boreholes/project/{projectId}/structure/{structureId}
- `createBorehole` - POST /boreholes
- `updateBorehole` - PUT /boreholes/{boreholeId}
- `deleteBorehole` - DELETE /boreholes/{boreholeId}

#### 10. **S3/Parquet Infrastructure** (2 handlers) - ❌ DO NOT TOUCH
- `parquetRepository` - Python Lambda (internal invocation only)
- `borelogParser` - Python Lambda (SQS-triggered)

**Total in backend: ~54 handlers**

---

### 🚀 **backendbore-ops** (NEW SERVICE - Operational Domains)

These handlers will be moved to the new `backendbore-ops` service:

#### 1. **Lab Requests Domain** (6 handlers)
- `createLabRequest` - POST /lab-requests
- `listLabRequests` - GET /lab-requests
- `getLabRequestById` - GET /lab-requests/{id}
- `updateLabRequest` - PUT /lab-requests/{id}
- `deleteLabRequest` - DELETE /lab-requests/{id}
- `getFinalBorelogs` - GET /lab-requests/final-borelogs

#### 2. **Lab Tests Domain** (2 handlers)
- `createLabTest` - POST /lab-tests
- `listLabTests` - GET /lab-tests

#### 3. **Unified Lab Reports Domain** (9 handlers)
- `createUnifiedLabReport` - POST /unified-lab-reports
- `getUnifiedLabReport` - GET /unified-lab-reports/{reportId}
- `updateUnifiedLabReport` - PUT /unified-lab-reports/{reportId}
- `getUnifiedLabReports` - GET /unified-lab-reports
- `deleteUnifiedLabReport` - DELETE /unified-lab-reports/{reportId}
- `approveUnifiedLabReport` - POST /unified-lab-reports/{reportId}/approve
- `rejectUnifiedLabReport` - POST /unified-lab-reports/{reportId}/reject
- `submitUnifiedLabReport` - POST /unified-lab-reports/{reportId}/submit
- `getLabReports` - GET /lab-reports (alias)

#### 4. **Lab Report Version Control Domain** (5 handlers)
- `saveLabReportDraft` - POST /lab-reports/draft
- `submitLabReportForReview` - POST /lab-reports/submit
- `reviewLabReport` - POST /lab-reports/{report_id}/review
- `getLabReportVersionHistory` - GET /lab-reports/{report_id}/versions
- `getLabReportVersion` - GET /lab-reports/{report_id}/version/{version_no}

#### 5. **Soil Test Samples Domain** (4 handlers)
- `getSoilTestSamples` - GET /unified-lab-reports/{reportId}/soil-samples
- `getSoilTestSample` - GET /soil-test-samples/{sampleId}
- `updateSoilTestSample` - PUT /soil-test-samples/{sampleId}
- `deleteSoilTestSample` - DELETE /soil-test-samples/{sampleId}

#### 6. **Rock Test Samples Domain** (4 handlers)
- `getRockTestSamples` - GET /unified-lab-reports/{reportId}/rock-samples
- `getRockTestSample` - GET /rock-test-samples/{sampleId}
- `updateRockTestSample` - PUT /rock-test-samples/{sampleId}
- `deleteRockTestSample` - DELETE /rock-test-samples/{sampleId}


#### 7. **Workflow Actions Domain** (5 handlers)
- `submitForReview` - POST /workflow/{borelog_id}/submit
- `reviewBorelog` - POST /workflow/{borelog_id}/review
- `assignLabTests` - POST /workflow/lab-assignments
- `submitLabTestResults` - POST /workflow/lab-results
- `getWorkflowStatus` - GET /workflow/{borelog_id}/status

#### 8. **Workflow Dashboard Domain** (4 handlers)
- `getPendingReviews` - GET /workflow/pending-reviews
- `getLabAssignments` - GET /workflow/lab-assignments
- `getWorkflowStatistics` - GET /workflow/statistics
- `getSubmittedBorelogs` - GET /workflow/submitted-borelogs

#### 9. **Contacts Domain** (6 handlers)
- `createContact` - POST /contacts
- `listContacts` - GET /contacts
- `getContactById` - GET /contacts/{contact_id}
- `getContactsByOrganisation` - GET /contacts/organisation/{organisation_id}
- `updateContact` - PUT /contacts/{contact_id}
- `deleteContact` - DELETE /contacts/{contact_id}

#### 10. **Pending CSV Uploads Domain** (3 handlers)
- `listPendingCSVUploads` - GET /pending-csv-uploads
- `getPendingCSVUpload` - GET /pending-csv-uploads/{upload_id}
- `approvePendingCSVUpload` - POST /pending-csv-uploads/{upload_id}/approve

#### 11. **Unified Lab Report CSV Upload** (1 handler)
- `uploadUnifiedLabReportCSV` - POST /unified-lab-reports/upload-csv

#### 12. **User Management Domain** (4 handlers) - MOVED TO OPS
- `listUsers` - GET /users
- `getUserById` - GET /users/{user_id}
- `getLabEngineers` - GET /users/lab-engineers
- `assignUsers` - POST /assignments


#### 13. **Anomalies Domain** (3 handlers) - MOVED TO OPS
- `listAnomalies` - GET /anomalies
- `createAnomaly` - POST /anomalies
- `updateAnomaly` - PATCH /anomalies/{anomaly_id}

**Total in backendbore-ops: ~56 handlers**

---
## CloudFormation Resource Reduction Analysis

### Current State (Single Service)
- **Total Handlers**: ~100+ Lambda functions
- **Estimated Resources**: 500-700+ (exceeding AWS limit of 500)
- **Breakdown per handler**: ~5-7 resources each

### After Split

#### backend (EXISTING - NO RENAMING)
- **Handlers**: ~54 handlers
- **Estimated Resources**: ~270-378 resources
- **Status**: ✅ **BELOW 500 limit**
- **Changes**: Only remove handler definitions from `backend/serverless.ts` (NO service rename)


#### backendbore-ops (NEW SERVICE)
- **Handlers**: ~56 handlers
- **Estimated Resources**: ~280-392 resources
- **Status**: ✅ **BELOW 500 limit**

### Resource Reduction Strategy

Each Lambda function typically creates:
1. `AWS::Lambda::Function` (1 resource)
2. `AWS::IAM::Role` (1 resource)
3. `AWS::Logs::LogGroup` (1 resource)
4. `AWS::ApiGateway::RestApi` (shared, but methods/resources add up)
5. `AWS::ApiGateway::Resource` (1 per unique path segment)
6. `AWS::ApiGateway::Method` (1 per HTTP method)
7. `AWS::ApiGateway::Integration` (1 per method)
8. `AWS::Lambda::Permission` (1 per API Gateway integration)

**By moving 56 handlers**, we reduce `backend` by approximately:
- **56 Lambda Functions** = ~280-392 fewer resources
- This brings `backend` from **500-700+** down to **~270-378** resources
- **Result**: ✅ Both services will be **BELOW 500 resource limit**

---

## Explicit Confirmations

### ✅ Service Naming
- **`backend`** service: Stays named `backend` (NO renaming to `backendbore-core`)
- **`backendbore-ops`**: New service created from scratch
- Only handler definitions removed from `backend/serverless.ts` (no service name changes)


### ✅ Borelog Domain - UNTOUCHED
- All 18 borelog handlers remain in `backend`
- All borelog-related assignments, images, submissions stay
- No borelog logic, handlers, folders, or configuration will be modified

### ✅ S3 Logic - UNTOUCHED
- `parquetRepository` Lambda stays in `backend`
- `borelogParser` Lambda stays in `backend`
- All S3 client code (`src/storage/s3Client.ts`) remains untouched
- All S3-related helpers, keys, workflows remain unchanged
- **ZERO lines of S3 code will be modified**

### ✅ Protected Domains - UNTOUCHED
- **Auth**: All 3 handlers stay in `backend`
- **Projects**: All 3 handlers stay in `backend`
- **Substructures**: All 3 handlers stay in `backend`
- **Stratum Data**: All 2 handlers stay in `backend`
- **Geological Logs**: All 7 handlers stay in `backend` (related to borelog)


### ✅ Business Logic - UNTOUCHED
- No handler code will be modified
- Handlers will be moved VERBATIM (copy-paste, no edits)
- No validation, control flow, return shapes, or error handling changes
- No API path, HTTP method, or request/response format changes

---

## Implementation Strategy

### Phase 3 Execution Plan (After Approval)

1. **Create `backendbore-ops` service structure**
   - Create new `backendbore-ops/` directory
   - Copy `backend/serverless.ts` as template to `backendbore-ops/serverless.ts`
   - Update service name in `backendbore-ops/serverless.ts` to `backendbore-ops`
   - Reuse same provider config and environment variables

   2. **Move handlers VERBATIM to `backendbore-ops`**
   - Copy handler files from `backend/src/handlers/` to `backendbore-ops/src/handlers/`
   - Copy handler definitions from `backend/serverless.ts` to `backendbore-ops/serverless.ts`
   - **NO CODE MODIFICATIONS** - exact copy

3. **Update `backend/serverless.ts` ONLY**
   - Remove moved handler definitions from `backend/serverless.ts`
   - Keep service name as `backend` (NO renaming)
   - Keep all other configuration identical
   - Keep all remaining handler definitions

4. **Shared Dependencies**
   - Both services will share:
     - Same database connection (via env vars)
     - Same S3 bucket (via env vars)
     - Same JWT secret (via env vars)
     - Same utility functions (copied to `backendbore-ops`, not modified)


5. **Deployment Verification**
   - Deploy `backend` first (verify resources < 500)
   - Deploy `backendbore-ops` (verify resources < 500)
   - Test all APIs still function

---

## Risk Assessment

### ✅ Low Risk
- Handlers are moved verbatim (no code changes)
- Same environment variables and database
- No business logic modifications
- Protected domains explicitly untouched
- `backend` service name unchanged (no breaking changes)


### ⚠️ Considerations
- API Gateway endpoints will be split across two services
- Frontend may need to route to different base URLs (or use API Gateway custom domain)
- Both services need same IAM permissions for database and S3
- Deployment order: `backend` first, then `backendbore-ops`

---

## Summary

| Metric | Before | After (backend) | After (backendbore-ops) |
|--------|--------|-----------------|-------------------------|
| **Service Name** | `backend` | `backend` (unchanged) | `backendbore-ops` (new) |
| **Handlers** | ~100+ | ~54 | ~56 |
| **Estimated Resources** | 500-700+ | ~270-378 | ~280-392 |
| **Status** | ❌ Exceeds limit | ✅ Below limit | ✅ Below limit |

**Result**: 
- `backend` service remains named `backend` (NO renaming)
- Only handler definitions removed from `backend/serverless.ts`
- New `backendbore-ops` service created with moved handlers
- Both services operate independently, each below the 500-resource CloudFormation limit
- All protected domains (Borelog, S3, Auth, Projects, Substructure, Stratum) remain untouched in `backend`

---

## 🚫 STOP POINT - PHASE 1 COMPLETE

**NO CODE CHANGES** have been made. This is a planning document only.

**Key Points**:
- ✅ `backend` service stays as `backend` (NO renaming)
- ✅ Only create new `backendbore-ops` service
- ✅ Only remove handler definitions from `backend/serverless.ts`
- ✅ All handler code moved verbatim (no modifications)

**Awaiting explicit approval**: "Plan approved. Proceed."
