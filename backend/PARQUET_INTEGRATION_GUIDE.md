# Parquet Integration Guide

## Overview

This guide documents the integration of Node.js Lambda handlers with the Python Parquet Lambda for data persistence.

## Architecture

```
Node.js Lambda Handler
    ↓ (preserves validation & role logic)
Model Layer (geologicalLog.ts, etc.)
    ↓ (calls Parquet service)
Parquet Service (parquetService.ts)
    ↓ (invokes Python Lambda)
Python Parquet Lambda
    ↓ (writes to)
S3 / Local Filesystem (Parquet files)
```

## Integration Status

### ✅ Completed: Geological Logs

**Files Updated:**
- `src/services/parquetService.ts` - Service layer for Lambda invocations
- `src/models/geologicalLog.ts` - Model layer using Parquet service

**Functions Migrated:**
- ✅ `insertGeologicalLog()` - Creates entity in Parquet
- ✅ `getGeologicalLogById()` - Gets entity from Parquet
- ✅ `getGeologicalLogsByProjectName()` - Lists entities by project
- ✅ `getAllGeologicalLogs()` - Lists all entities
- ✅ `updateGeologicalLog()` - Updates entity (creates new version)
- ✅ `deleteGeologicalLog()` - Marked as checked (immutable storage)

**Handlers Updated:**
- ✅ `createGeologicalLog.ts` - Uses updated model (no changes needed)
- ✅ `listGeologicalLogs.ts` - Uses updated model (no changes needed)
- ✅ `getGeologicalLogById.ts` - Uses updated model (no changes needed)
- ✅ `updateGeologicalLog.ts` - Uses updated model (no changes needed)
- ✅ `deleteGeologicalLog.ts` - Uses updated model (no changes needed)
- ✅ `getGeologicalLogsByProjectName.ts` - Uses updated model (no changes needed)

### 🔄 In Progress: Borelogs

**Files to Update:**
- `src/models/borelogDetails.ts`
- `src/handlers/createBorelog.ts`
- `src/handlers/getBorelogDetailsByBorelogId.ts`
- `src/handlers/getBorelogsByProject.ts`
- `src/handlers/approveBorelog.ts`
- Other borelog-related handlers

### 🔄 Pending: Lab Tests

**Files to Update:**
- `src/models/unifiedLabReports.ts` (if exists)
- `src/handlers/unifiedLabReports.ts`
- `src/handlers/labReportVersionControl.ts`
- Other lab test handlers

## Data Mapping

### Geological Log

**Node.js Entity:** `GeologicalLog`
**Parquet Entity Type:** `geological_log`
**Entity ID:** `borelog_id`
**Project ID:** Derived from `project_name` via `getProjectIdFromName()`

**Field Mappings:**
- `coordinate` → `coordinate_latitude` + `coordinate_longitude`
- `size_of_core_pieces_distribution` → JSON string
- All other fields map 1:1

### Borelog

**Node.js Entity:** `BorelogDetails`
**Parquet Entity Type:** `borelog`
**Entity ID:** `borelog_id`
**Project ID:** From `boreloge.project_id`

### Lab Test

**Node.js Entity:** `UnifiedLabReport`
**Parquet Entity Type:** `lab_test`
**Entity ID:** `report_id`
**Project ID:** From report data

## Parquet Service API

### Helper Functions

```typescript
// Get project_id from project_name
getProjectIdFromName(projectName: string): Promise<string | null>

// Get project_id from borelog_id
getProjectIdFromBorelogId(borelogId: string): Promise<string | null>
```

### CRUD Operations

```typescript
// Create
createParquetEntity(
  entityType: ParquetEntityType,
  projectId: string,
  entityId: string,
  payload: any,
  user: string,
  comment?: string
): Promise<any>

// Read
getParquetEntity(
  entityType: ParquetEntityType,
  projectId: string,
  entityId: string
): Promise<any | null>

// Update
updateParquetEntity(
  entityType: ParquetEntityType,
  projectId: string,
  entityId: string,
  payload: any,
  user: string,
  comment?: string
): Promise<any>

// List
listParquetEntities(
  entityType: ParquetEntityType,
  projectId: string,
  status?: string
): Promise<any[]>

// Approve
approveParquetEntity(
  entityType: ParquetEntityType,
  projectId: string,
  entityId: string,
  approver: string,
  comment?: string
): Promise<any>
```

## Environment Variables

**Required:**
- `PARQUET_LAMBDA_FUNCTION_NAME` - Name of Python Lambda function (default: `parquet-repository`)
- `AWS_REGION` - AWS region (default: `us-east-1`)

**Python Lambda Environment:**
- `STORAGE_MODE` - `s3` or `local`
- `S3_BUCKET_NAME` - Required for S3 mode
- `BASE_PATH` - Base path for storage

## Data Transformation

### Coordinate Conversion

**PostgreSQL → Parquet:**
```typescript
coordinate: { type: 'Point', coordinates: [lng, lat] }
  ↓
coordinate_latitude: lat
coordinate_longitude: lng
```

**Parquet → Node.js:**
```typescript
coordinate_latitude: lat
coordinate_longitude: lng
  ↓
coordinate: { type: 'Point', coordinates: [lng, lat] }
```

### JSONB Fields

**PostgreSQL → Parquet:**
```typescript
size_of_core_pieces_distribution: { ... }
  ↓
size_of_core_pieces_distribution: JSON.stringify({ ... })
```

**Parquet → Node.js:**
```typescript
size_of_core_pieces_distribution: "..."
  ↓
size_of_core_pieces_distribution: JSON.parse("...")
```

## Error Handling

The Parquet service handles errors gracefully:

- **Lambda invocation errors** → Logged and re-thrown
- **Entity not found** → Returns `null` (not an error)
- **Missing project_id** → Throws error with descriptive message

## Testing

### Local Testing

1. Set environment variables:
```bash
export PARQUET_LAMBDA_FUNCTION_NAME=parquet-repository
export AWS_REGION=us-east-1
```

2. Ensure Python Lambda is running locally or deployed

3. Test handlers:
```bash
npm test
```

### Integration Testing

1. Deploy Python Lambda
2. Set `PARQUET_LAMBDA_FUNCTION_NAME` to deployed function name
3. Test Node.js handlers against deployed Lambda

## Migration Checklist

### Geological Logs ✅

- [x] Create `parquetService.ts`
- [x] Update `geologicalLog.ts` model
- [x] Test `createGeologicalLog` handler
- [x] Test `listGeologicalLogs` handler
- [x] Test `getGeologicalLogById` handler
- [x] Test `updateGeologicalLog` handler
- [x] Test `deleteGeologicalLog` handler
- [x] Verify API responses unchanged
- [x] Verify frontend compatibility

### Borelogs 🔄

- [ ] Update `borelogDetails.ts` model
- [ ] Update `createBorelog.ts` handler
- [ ] Update `getBorelogDetailsByBorelogId.ts` handler
- [ ] Update `getBorelogsByProject.ts` handler
- [ ] Update `approveBorelog.ts` handler
- [ ] Update other borelog handlers
- [ ] Test all handlers
- [ ] Verify API responses unchanged

### Lab Tests 🔄

- [ ] Identify lab test models
- [ ] Update lab test models
- [ ] Update lab test handlers
- [ ] Test all handlers
- [ ] Verify API responses unchanged

## Important Notes

### Immutability

- Parquet files are **never overwritten**
- Updates create **new versions**
- Deletes are **not supported** (immutable storage)
- Consider adding "deleted" status flag if needed

### Project ID Resolution

- Geological logs use `project_name` → resolve to `project_id`
- Borelogs have `project_id` directly
- Lab tests may need project resolution

### Coordinate Handling

- PostgreSQL uses `GEOGRAPHY(POINT)`
- Parquet uses separate `latitude`/`longitude` columns
- Transform on read/write

### Versioning

- Each update creates a new version
- Latest version is returned by default
- Use `getParquetEntityVersion()` for specific versions

## Rollback Plan

If issues arise:

1. **Quick Rollback:** Set `USE_PARQUET=false` environment variable
2. **Model Layer:** Add feature flag to switch between PostgreSQL and Parquet
3. **Gradual Migration:** Migrate one entity type at a time

## Next Steps

1. Complete borelog integration
2. Complete lab test integration
3. Add comprehensive error handling
4. Add retry logic for Lambda invocations
5. Add caching layer if needed
6. Performance testing
7. Load testing







