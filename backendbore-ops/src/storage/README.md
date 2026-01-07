# Storage Abstraction Layer

A clean, minimal abstraction layer for S3 + Parquet storage operations.

## Overview

This module provides a unified interface for storing and reading Parquet files that works seamlessly in both:
- **Production**: Real S3 operations via AWS SDK
- **Local Development**: File system operations when `IS_OFFLINE=true`

## Architecture

```
src/storage/
├── s3Client.ts          # S3/local filesystem client abstraction
├── parquetWriter.ts     # Parquet file writing interface
├── parquetReader.ts     # Parquet file reading interface
├── metadataManager.ts   # Parquet file metadata management
└── index.ts             # Main exports
```

## Key Features

- ✅ **Environment-aware**: Automatically switches between S3 and local filesystem
- ✅ **No business logic**: Pure storage abstraction layer
- ✅ **Well-documented**: Comprehensive JSDoc comments
- ✅ **Type-safe**: Full TypeScript support
- ✅ **Minimal dependencies**: Uses existing AWS SDK

## Usage

### Basic Setup

```typescript
import { createStorageClient } from './storage';

// Create storage client (automatically detects IS_OFFLINE)
const storage = createStorageClient();
```

### Writing Parquet Files

```typescript
import { createParquetWriter, generateParquetKey, type ParquetSchema } from './storage';

// Define schema
const schema: ParquetSchema[] = [
  { name: 'id', type: 'STRING' },
  { name: 'value', type: 'DOUBLE', optional: true },
  { name: 'timestamp', type: 'TIMESTAMP_MILLIS' },
];

// Generate file key
const key = generateParquetKey('boreholes/borelog_versions', 'project_id=123/year=2025/month=01');

// Create writer
const writer = createParquetWriter(storage, key, schema, {
  compression: 'SNAPPY',
  rowGroupSize: 50000,
});

// Write data
await writer.writeRows([
  { id: '1', value: 123.45, timestamp: new Date() },
  { id: '2', value: 678.90, timestamp: new Date() },
]);

// Close and finalize
await writer.close();
const location = writer.getLocation();
```

### Reading Parquet Files

```typescript
import { createParquetReader } from './storage';

// Create reader
const reader = createParquetReader(storage, 'path/to/file.parquet');

// Read all rows
const allRows = await reader.readAll({
  limit: 1000,
  columns: ['id', 'value'], // Only read specific columns
});

// Read in batches (for large files)
for await (const batch of reader.readBatch(1000)) {
  // Process batch
  console.log(`Processed ${batch.length} rows`);
}

// Get metadata
const metadata = await reader.getMetadata();
console.log(`File has ${metadata.rowCount} rows`);

// Close reader
await reader.close();
```

### Managing Metadata

```typescript
import { createMetadataManager } from './storage';

const metadataManager = createMetadataManager(storage);

// Register a file
await metadataManager.registerFile({
  key: 'boreholes/borelog_versions/data.parquet',
  tableName: 'borelog_versions',
  partition: 'project_id=123/year=2025/month=01',
  schemaVersion: 1,
  rowCount: 1000,
  fileSize: 1024000,
  exportedAt: new Date(),
  compression: 'SNAPPY',
});

// List files for a table
const files = await metadataManager.listTableFiles('borelog_versions');

// Get partition info
const partitionInfo = await metadataManager.getPartitionInfo(
  'borelog_versions',
  'project_id=123/year=2025/month=01'
);

// Get table statistics
const stats = await metadataManager.getTableStats('borelog_versions');
```

## Environment Variables

```bash
# Required (unless IS_OFFLINE=true)
S3_BUCKET_NAME=your-bucket-name
# OR
PARQUET_BUCKET_NAME=your-parquet-bucket-name

AWS_REGION=us-east-1

# For local development
IS_OFFLINE=true
LOCAL_STORAGE_PATH=./local-storage  # Optional, defaults to ./local-storage
```

## Implementation Status

### ✅ Completed
- S3/local filesystem client abstraction
- Parquet writer interface (placeholder implementation)
- Parquet reader interface (placeholder implementation)
- Metadata management system
- Environment-aware mode switching

### 🔄 TODO (Future Implementation)
- Integrate actual Parquet library (e.g., `parquetjs` or `@dsnp/parquetjs`)
- Implement actual Parquet file generation in `parquetWriter.ts`
- Implement actual Parquet file parsing in `parquetReader.ts`
- Add Parquet schema validation
- Add Parquet file compression support
- Add Parquet file merging/compaction utilities

## Design Principles

1. **No Business Logic**: This layer only handles storage operations. Business logic belongs in handlers/services.

2. **Additive Only**: This module does not modify existing code. It's a new addition to the codebase.

3. **Environment Aware**: Automatically adapts to production (S3) or development (local filesystem) environments.

4. **Type Safe**: Full TypeScript support with comprehensive type definitions.

5. **Well Documented**: Every function and class has JSDoc comments explaining purpose and usage.

## File Structure

### `s3Client.ts`
- `StorageClient`: Unified S3/local filesystem client
- `createStorageClient()`: Factory function to create client instance
- Supports: upload, download, exists, metadata, list, delete

### `parquetWriter.ts`
- `ParquetFileWriter`: Write Parquet files
- `createParquetWriter()`: Factory function
- `generateParquetKey()`: Helper for generating file paths
- **Note**: Actual Parquet writing is placeholder - needs Parquet library integration

### `parquetReader.ts`
- `ParquetFileReader`: Read Parquet files
- `createParquetReader()`: Factory function
- `parquetFileExists()`: Helper to check file existence
- **Note**: Actual Parquet reading is placeholder - needs Parquet library integration

### `metadataManager.ts`
- `ParquetMetadataManager`: Manage Parquet file metadata
- `createMetadataManager()`: Factory function
- Features: file registration, partition tracking, table statistics

## Testing

When `IS_OFFLINE=true`, all operations use the local filesystem:
- Files are stored in `./local-storage/` (or `LOCAL_STORAGE_PATH`)
- No AWS credentials required
- Perfect for local development and testing

## Next Steps

1. **Add Parquet Library**: Install and integrate a Parquet library (e.g., `parquetjs`)
2. **Implement Writers**: Complete the `ParquetFileWriter.writeRow()` and `writeRows()` methods
3. **Implement Readers**: Complete the `ParquetFileReader.readAll()` and `readBatch()` methods
4. **Add Schema Validation**: Validate data against Parquet schemas before writing
5. **Add Business Logic**: Create handlers/services that use this abstraction layer

## Notes

- This is a **minimal, foundational layer**. Actual Parquet operations are placeholders.
- The interface is designed to be stable - business logic can be built on top without changes.
- All methods are async and return Promises for consistency.
- Error handling is comprehensive with detailed error messages.

