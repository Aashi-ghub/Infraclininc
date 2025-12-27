# S3 Storage Implementation Summary

## Overview

This document describes the S3-based file storage implementation added to the backend. The implementation follows strict constraints to ensure backward compatibility and cost safety.

## Key Changes

### 1. Storage Service Abstraction (`src/services/storageService.ts`)

Created a new storage service abstraction layer that:
- Provides `uploadFile()` and `getPublicOrSignedUrl()` methods
- Supports S3 in production and mocked storage in local development (`IS_OFFLINE=true`)
- Includes file size and MIME type validation
- Generates deterministic S3 keys: `projects/{project_id}/borelogs/{borelog_id}/{file_type}/filename`

**File Size Limits:**
- CSV: ≤ 10 MB
- Images: ≤ 5 MB
- PDFs: ≤ 10 MB

**Allowed MIME Types:**
- CSV: `text/csv`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `text/plain`
- Images: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `image/webp`
- PDFs: `application/pdf`

### 2. Database Migration

**File:** `migrations/add_file_url_to_pending_csv_uploads.sql`

Added `file_url` column to `pending_csv_uploads` table to store S3 URLs. This is an additive change that doesn't break existing functionality.

### 3. Updated CSV Upload Handlers

#### `uploadBoreholeCsv.ts`
- Uploads CSV file to S3 before parsing
- Stores S3 URL in database
- Validates file size and MIME type
- Maintains backward compatibility with existing API contract

#### `uploadBorelogCSV.ts`
- Uploads CSV/Excel file to S3 before parsing
- Stores S3 URL in database
- Handles both CSV and Excel formats
- Gracefully handles missing `file_url` column (logs warning)

### 4. Updated Image Upload Handler

#### `borelogImages.ts`
- Supports two modes:
  1. **New mode**: Accepts `image_data` (base64) and uploads to S3
  2. **Backward compatible**: Accepts `image_url` (existing behavior)
- Validates image file size and MIME type
- Automatically determines project_id from borelog if not provided

### 5. Dependencies Added

Added to `package.json`:
- `@aws-sdk/client-s3`: ^3.370.0
- `@aws-sdk/s3-request-presigner`: ^3.370.0

## Environment Variables Required

```bash
AWS_REGION=us-east-1  # Your AWS region
S3_BUCKET_NAME=your-bucket-name  # Your S3 bucket name
IS_OFFLINE=true  # Set to true for local development (uses mocked storage)
```

## Local Development

When `IS_OFFLINE=true`:
- Storage service returns mocked S3 URLs (format: `https://mock-storage.local/{key}`)
- No actual AWS access required
- Files are not uploaded to S3 (can be extended to save to local filesystem if needed)

## API Changes

### CSV Upload APIs

**No breaking changes** - APIs continue to accept the same request format:
- `csvContent` / `csvData`: File content as string (base64 or raw text)
- `fileName`: Optional filename (recommended for better S3 organization)
- `projectId`, `structureId`, `substructureId`: Required for S3 key generation

**New behavior:**
- Files are automatically uploaded to S3 before parsing
- S3 URL is stored in `file_url` column (if migration is run)

### Image Upload API

**Backward compatible** - Supports both modes:

**Mode 1: File Upload (New)**
```json
{
  "borelog_id": "uuid",
  "image_data": "base64-encoded-image-data",
  "file_name": "image.jpg",
  "project_id": "uuid"  // Optional if borelog_id exists
}
```

**Mode 2: URL (Existing)**
```json
{
  "borelog_id": "uuid",
  "image_url": "https://example.com/image.jpg"
}
```

## Cost Safety Features

1. **File Size Limits**: Enforced in backend before upload
2. **MIME Type Validation**: Only whitelisted types allowed
3. **No S3 Versioning**: Not enabled programmatically
4. **No Lifecycle Rules**: Not created programmatically
5. **Transaction Safety**: Database writes only happen after successful S3 upload
6. **No Retries**: Prevents duplicate uploads

## Migration Steps

1. **Run Database Migration:**
   ```bash
   # Run the migration to add file_url column
   psql -d your_database -f migrations/add_file_url_to_pending_csv_uploads.sql
   ```

2. **Set Environment Variables:**
   ```bash
   export AWS_REGION=us-east-1
   export S3_BUCKET_NAME=your-bucket-name
   ```

3. **Install Dependencies:**
   ```bash
   npm install
   ```

4. **Deploy:**
   ```bash
   npm run deploy
   ```

## Backward Compatibility

- All existing APIs continue to work unchanged
- Image upload API supports both file upload and URL modes
- Database schema changes are additive (new nullable column)
- No breaking changes to API contracts

## Future Enhancements

- Add local filesystem storage option for offline mode
- Add file deletion endpoint (with proper authorization)
- Add file download endpoint with signed URLs
- Consider adding file metadata (size, upload date, etc.) to database

## Notes

- S3 bucket must already exist (not created by this code)
- IAM credentials are assumed to be injected via Lambda role or local AWS credentials
- Files are never overwritten - each upload generates a unique filename with timestamp
- Old files are never deleted automatically (manual cleanup required if needed)













