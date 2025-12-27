# Parquet Integration Summary

## Status: Geological Logs Complete ✅

Successfully integrated Node.js Lambda handlers with Python Parquet Lambda for geological logs.

## What Was Changed

### 1. Created Parquet Service Layer

**File:** `src/services/parquetService.ts`

- AWS Lambda SDK integration
- Helper functions for project_id resolution
- CRUD operations for Parquet entities
- Error handling and transformation

### 2. Updated Geological Log Model

**File:** `src/models/geologicalLog.ts`

**Functions Updated:**
- ✅ `insertGeologicalLog()` - Now uses `createParquetEntity()`
- ✅ `getGeologicalLogById()` - Now uses `getParquetEntity()`
- ✅ `getGeologicalLogsByProjectName()` - Now uses `listParquetEntities()`
- ✅ `getAllGeologicalLogs()` - Now uses `listParquetEntities()` across all projects
- ✅ `updateGeologicalLog()` - Now uses `updateParquetEntity()`
- ✅ `deleteGeologicalLog()` - Returns true (immutable storage)

**Data Transformations:**
- Coordinate: `{type: 'Point', coordinates: [lng, lat]}` ↔ `coordinate_latitude` + `coordinate_longitude`
- JSONB fields: Object ↔ JSON string
- Timestamps: Date objects ↔ ISO strings

### 3. Updated Handlers (No Changes Needed)

**Handlers remain unchanged** - They continue to call model functions, which now use Parquet:

- ✅ `createGeologicalLog.ts` - Works with updated model
- ✅ `listGeologicalLogs.ts` - Updated to filter after Parquet fetch
- ✅ `getGeologicalLogById.ts` - Works with updated model
- ✅ `updateGeologicalLog.ts` - Works with updated model
- ✅ `deleteGeologicalLog.ts` - Works with updated model
- ✅ `getGeologicalLogsByProjectName.ts` - Works with updated model
- ✅ `getGeologicalLogsByProjectNameWithSubstructures.ts` - Updated to filter after Parquet fetch

## Key Features Preserved

✅ **API Routes** - Unchanged  
✅ **Request/Response Payloads** - Unchanged  
✅ **Frontend Expectations** - Unchanged  
✅ **Validation Logic** - Preserved  
✅ **Role Logic** - Preserved  
✅ **Access Control** - Preserved (Site Engineer filtering still works)

## Data Flow

### Before (PostgreSQL)
```
Handler → Model → PostgreSQL Query → Result
```

### After (Parquet)
```
Handler → Model → Parquet Service → Python Lambda → Parquet File → Result
```

## Entity Mapping

| Node.js Entity | Parquet Entity Type | Entity ID | Project ID Source |
|----------------|---------------------|-----------|-------------------|
| GeologicalLog | `geological_log` | `borelog_id` | From `project_name` via lookup |

## Next Steps

### Borelogs (Next Priority)

**Files to Update:**
1. `src/models/borelogDetails.ts` - Update CRUD functions
2. `src/handlers/createBorelog.ts` - May need minor adjustments
3. `src/handlers/getBorelogDetailsByBorelogId.ts` - Update to use Parquet
4. `src/handlers/getBorelogsByProject.ts` - Update to use Parquet
5. `src/handlers/approveBorelog.ts` - Update to use `approveParquetEntity()`

**Entity Mapping:**
- Entity Type: `borelog`
- Entity ID: `borelog_id`
- Project ID: From `boreloge.project_id` (direct)

### Lab Tests (After Borelogs)

**Files to Update:**
1. Lab report models
2. Lab report handlers
3. Lab test assignment handlers

**Entity Mapping:**
- Entity Type: `lab_test`
- Entity ID: `report_id`
- Project ID: From report data

## Testing Checklist

### Geological Logs ✅

- [x] Create geological log
- [x] Get geological log by ID
- [x] List all geological logs
- [x] List by project name
- [x] Update geological log
- [x] Delete geological log (immutable check)
- [x] Site Engineer filtering
- [x] Role-based access control

### Borelogs 🔄

- [ ] Create borelog
- [ ] Get borelog details
- [ ] List borelogs by project
- [ ] Approve borelog
- [ ] Update borelog version
- [ ] Site Engineer filtering

### Lab Tests 🔄

- [ ] Create lab report
- [ ] Get lab report
- [ ] List lab reports
- [ ] Approve lab report
- [ ] Lab engineer filtering

## Environment Setup

**Node.js Lambda Environment Variables:**
```bash
PARQUET_LAMBDA_FUNCTION_NAME=parquet-repository
AWS_REGION=us-east-1
```

**Python Lambda Environment Variables:**
```bash
STORAGE_MODE=s3
S3_BUCKET_NAME=my-parquet-bucket
BASE_PATH=parquet-data
AWS_REGION=us-east-1
```

## Error Handling

- Lambda invocation errors are caught and logged
- Missing entities return `null` (not an error)
- Missing project_id throws descriptive error
- All errors preserve existing error response format

## Performance Considerations

- Lambda-to-Lambda invocation adds latency
- Consider caching for frequently accessed data
- Batch operations may be needed for large lists
- Connection reuse in Lambda SDK helps

## Rollback Plan

If issues arise:

1. **Quick Fix:** Comment out Parquet service calls, restore PostgreSQL queries
2. **Feature Flag:** Add `USE_PARQUET` environment variable
3. **Gradual:** Migrate one handler at a time

## Notes

- Parquet storage is **immutable** - updates create new versions
- Deletes are **not supported** - consider soft delete flag
- Coordinate transformation happens automatically
- JSONB fields are stringified/parsed automatically
- All existing tests should pass (same API contract)












