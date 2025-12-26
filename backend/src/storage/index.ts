/**
 * Storage Abstraction Layer - Main Export
 * 
 * Provides a unified interface for S3 + Parquet storage operations.
 * 
 * This module exports:
 * - StorageClient: S3/local filesystem operations
 * - ParquetReader: Read Parquet files
 * - ParquetWriter: Write Parquet files
 * - ParquetMetadataManager: Manage Parquet file metadata
 * 
 * Usage:
 * ```typescript
 * import { createStorageClient, createParquetWriter, createParquetReader } from './storage';
 * 
 * const storage = createStorageClient();
 * const writer = createParquetWriter(storage, 'path/to/file.parquet', schema);
 * await writer.writeRows(data);
 * await writer.close();
 * ```
 */

export {
  StorageClient,
  createStorageClient,
  type S3ClientConfig,
  type S3ObjectMetadata,
} from './s3Client';

export {
  ParquetFileWriter,
  createParquetWriter,
  generateParquetKey,
  type ParquetWriter,
  type ParquetSchema,
  type ParquetWriteOptions,
} from './parquetWriter';

export {
  ParquetFileReader,
  createParquetReader,
  parquetFileExists,
  type ParquetReader,
  type ParquetReadOptions,
  type ParquetRow,
  type ParquetMetadata,
} from './parquetReader';

export {
  ParquetMetadataManager,
  createMetadataManager,
  type ParquetFileMetadata,
  type PartitionInfo,
} from './metadataManager';

