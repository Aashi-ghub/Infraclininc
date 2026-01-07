/**
 * Metadata Manager for Parquet Files
 * 
 * Manages metadata about Parquet files stored in S3 or local filesystem:
 * - File locations and paths
 * - Partition information
 * - Schema versions
 * - Export timestamps
 * - File statistics
 * 
 * This module does NOT contain business logic - it's a pure storage abstraction.
 */

import { StorageClient, S3ObjectMetadata } from './s3Client';
import { logger } from '../utils/logger';

export interface ParquetFileMetadata {
  /**
   * Storage key/path of the Parquet file
   */
  key: string;

  /**
   * Table name this file represents
   */
  tableName: string;

  /**
   * Partition path (e.g., 'project_id=123/year=2025/month=01')
   */
  partition?: string;

  /**
   * Schema version (for schema evolution)
   */
  schemaVersion: number;

  /**
   * Number of rows in this file
   */
  rowCount: number;

  /**
   * File size in bytes
   */
  fileSize: number;

  /**
   * Timestamp when file was created/exported
   */
  exportedAt: Date;

  /**
   * Compression type used
   */
  compression: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, string>;
}

export interface PartitionInfo {
  /**
   * Partition path (e.g., 'project_id=123/year=2025/month=01')
   */
  partition: string;

  /**
   * Number of files in this partition
   */
  fileCount: number;

  /**
   * Total rows across all files in this partition
   */
  totalRows: number;

  /**
   * Total size in bytes
   */
  totalSize: number;

  /**
   * Latest export timestamp
   */
  latestExport: Date;
}

/**
 * Metadata Manager Implementation
 * 
 * Stores metadata as JSON files in a metadata directory.
 * In production, metadata is stored in S3.
 * In offline mode, metadata is stored locally.
 */
export class ParquetMetadataManager {
  private storageClient: StorageClient;
  private metadataPrefix: string;

  constructor(storageClient: StorageClient, metadataPrefix: string = 'parquet-metadata') {
    this.storageClient = storageClient;
    this.metadataPrefix = metadataPrefix;

    logger.debug('ParquetMetadataManager initialized', { metadataPrefix });
  }

  /**
   * Generate metadata key for a table
   */
  private getMetadataKey(tableName: string, suffix: string = 'index.json'): string {
    return `${this.metadataPrefix}/${tableName}/${suffix}`;
  }

  /**
   * Generate partition metadata key
   */
  private getPartitionMetadataKey(tableName: string, partition: string): string {
    const sanitizedPartition = partition.replace(/[^a-zA-Z0-9=_-]/g, '_');
    return `${this.metadataPrefix}/${tableName}/partitions/${sanitizedPartition}.json`;
  }

  /**
   * Register a new Parquet file and its metadata
   */
  async registerFile(metadata: ParquetFileMetadata): Promise<void> {
    try {
      const metadataKey = this.getMetadataKey(metadata.tableName, `files/${metadata.key.replace(/\//g, '_')}.json`);
      
      const metadataJson = JSON.stringify({
        ...metadata,
        exportedAt: metadata.exportedAt.toISOString(),
      }, null, 2);

      await this.storageClient.uploadFile(
        metadataKey,
        Buffer.from(metadataJson, 'utf-8'),
        'application/json'
      );

      // Update partition info if partition exists
      if (metadata.partition) {
        await this.updatePartitionInfo(metadata.tableName, metadata.partition, metadata);
      }

      // Update table index
      await this.updateTableIndex(metadata.tableName, metadata);

      logger.debug('Parquet file metadata registered', {
        tableName: metadata.tableName,
        key: metadata.key,
        partition: metadata.partition,
      });
    } catch (error) {
      logger.error('Error registering Parquet file metadata', { error, metadata });
      throw new Error(`Failed to register file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get metadata for a specific file
   */
  async getFileMetadata(tableName: string, key: string): Promise<ParquetFileMetadata | null> {
    try {
      const metadataKey = this.getMetadataKey(tableName, `files/${key.replace(/\//g, '_')}.json`);
      
      if (!(await this.storageClient.fileExists(metadataKey))) {
        return null;
      }

      const buffer = await this.storageClient.downloadFile(metadataKey);
      const metadata = JSON.parse(buffer.toString('utf-8'));

      return {
        ...metadata,
        exportedAt: new Date(metadata.exportedAt),
      };
    } catch (error) {
      logger.error('Error getting file metadata', { error, tableName, key });
      return null;
    }
  }

  /**
   * List all files for a table
   */
  async listTableFiles(tableName: string, partition?: string): Promise<ParquetFileMetadata[]> {
    try {
      const filesPrefix = this.getMetadataKey(tableName, 'files/');
      const fileKeys = await this.storageClient.listFiles(filesPrefix);

      const files: ParquetFileMetadata[] = [];

      for (const fileKey of fileKeys) {
        try {
          const buffer = await this.storageClient.downloadFile(fileKey);
          const metadata = JSON.parse(buffer.toString('utf-8'));

          // Filter by partition if specified
          if (partition && metadata.partition !== partition) {
            continue;
          }

          files.push({
            ...metadata,
            exportedAt: new Date(metadata.exportedAt),
          });
        } catch (error) {
          logger.warn('Error reading file metadata', { error, fileKey });
          // Continue with other files
        }
      }

      // Sort by exportedAt descending (newest first)
      files.sort((a, b) => b.exportedAt.getTime() - a.exportedAt.getTime());

      return files;
    } catch (error) {
      logger.error('Error listing table files', { error, tableName, partition });
      throw new Error(`Failed to list table files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get partition information
   */
  async getPartitionInfo(tableName: string, partition: string): Promise<PartitionInfo | null> {
    try {
      const partitionKey = this.getPartitionMetadataKey(tableName, partition);
      
      if (!(await this.storageClient.fileExists(partitionKey))) {
        return null;
      }

      const buffer = await this.storageClient.downloadFile(partitionKey);
      const info = JSON.parse(buffer.toString('utf-8'));

      return {
        ...info,
        latestExport: new Date(info.latestExport),
      };
    } catch (error) {
      logger.error('Error getting partition info', { error, tableName, partition });
      return null;
    }
  }

  /**
   * List all partitions for a table
   */
  async listPartitions(tableName: string): Promise<PartitionInfo[]> {
    try {
      const partitionsPrefix = this.getMetadataKey(tableName, 'partitions/');
      const partitionKeys = await this.storageClient.listFiles(partitionsPrefix);

      const partitions: PartitionInfo[] = [];

      for (const partitionKey of partitionKeys) {
        try {
          const buffer = await this.storageClient.downloadFile(partitionKey);
          const info = JSON.parse(buffer.toString('utf-8'));

          partitions.push({
            ...info,
            latestExport: new Date(info.latestExport),
          });
        } catch (error) {
          logger.warn('Error reading partition info', { error, partitionKey });
          // Continue with other partitions
        }
      }

      return partitions;
    } catch (error) {
      logger.error('Error listing partitions', { error, tableName });
      throw new Error(`Failed to list partitions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update partition information
   */
  private async updatePartitionInfo(
    tableName: string,
    partition: string,
    fileMetadata: ParquetFileMetadata
  ): Promise<void> {
    try {
      const partitionKey = this.getPartitionMetadataKey(tableName, partition);
      let partitionInfo: PartitionInfo;

      if (await this.storageClient.fileExists(partitionKey)) {
        const buffer = await this.storageClient.downloadFile(partitionKey);
        partitionInfo = {
          ...JSON.parse(buffer.toString('utf-8')),
          latestExport: new Date(JSON.parse(buffer.toString('utf-8')).latestExport),
        };

        partitionInfo.fileCount += 1;
        partitionInfo.totalRows += fileMetadata.rowCount;
        partitionInfo.totalSize += fileMetadata.fileSize;

        if (fileMetadata.exportedAt > partitionInfo.latestExport) {
          partitionInfo.latestExport = fileMetadata.exportedAt;
        }
      } else {
        partitionInfo = {
          partition,
          fileCount: 1,
          totalRows: fileMetadata.rowCount,
          totalSize: fileMetadata.fileSize,
          latestExport: fileMetadata.exportedAt,
        };
      }

      const partitionJson = JSON.stringify({
        ...partitionInfo,
        latestExport: partitionInfo.latestExport.toISOString(),
      }, null, 2);

      await this.storageClient.uploadFile(
        partitionKey,
        Buffer.from(partitionJson, 'utf-8'),
        'application/json'
      );
    } catch (error) {
      logger.error('Error updating partition info', { error, tableName, partition });
      // Don't throw - partition info update is not critical
    }
  }

  /**
   * Update table index
   */
  private async updateTableIndex(
    tableName: string,
    fileMetadata: ParquetFileMetadata
  ): Promise<void> {
    try {
      const indexKey = this.getMetadataKey(tableName, 'index.json');
      let index: {
        totalFiles: number;
        totalRows: number;
        totalSize: number;
        latestExport: string;
        schemaVersion: number;
      };

      if (await this.storageClient.fileExists(indexKey)) {
        const buffer = await this.storageClient.downloadFile(indexKey);
        index = JSON.parse(buffer.toString('utf-8'));

        index.totalFiles += 1;
        index.totalRows += fileMetadata.rowCount;
        index.totalSize += fileMetadata.fileSize;

        if (fileMetadata.exportedAt.toISOString() > index.latestExport) {
          index.latestExport = fileMetadata.exportedAt.toISOString();
        }

        if (fileMetadata.schemaVersion > index.schemaVersion) {
          index.schemaVersion = fileMetadata.schemaVersion;
        }
      } else {
        index = {
          totalFiles: 1,
          totalRows: fileMetadata.rowCount,
          totalSize: fileMetadata.fileSize,
          latestExport: fileMetadata.exportedAt.toISOString(),
          schemaVersion: fileMetadata.schemaVersion,
        };
      }

      const indexJson = JSON.stringify(index, null, 2);

      await this.storageClient.uploadFile(
        indexKey,
        Buffer.from(indexJson, 'utf-8'),
        'application/json'
      );
    } catch (error) {
      logger.error('Error updating table index', { error, tableName });
      // Don't throw - index update is not critical
    }
  }

  /**
   * Get table statistics
   */
  async getTableStats(tableName: string): Promise<{
    totalFiles: number;
    totalRows: number;
    totalSize: number;
    latestExport: Date;
    schemaVersion: number;
  } | null> {
    try {
      const indexKey = this.getMetadataKey(tableName, 'index.json');
      
      if (!(await this.storageClient.fileExists(indexKey))) {
        return null;
      }

      const buffer = await this.storageClient.downloadFile(indexKey);
      const index = JSON.parse(buffer.toString('utf-8'));

      return {
        ...index,
        latestExport: new Date(index.latestExport),
      };
    } catch (error) {
      logger.error('Error getting table stats', { error, tableName });
      return null;
    }
  }
}

/**
 * Create a metadata manager instance
 * 
 * @param storageClient Storage client instance
 * @param metadataPrefix Prefix for metadata files (default: 'parquet-metadata')
 * @returns Metadata manager instance
 */
export function createMetadataManager(
  storageClient: StorageClient,
  metadataPrefix?: string
): ParquetMetadataManager {
  return new ParquetMetadataManager(storageClient, metadataPrefix);
}

