/**
 * S3 Client Abstraction Layer
 * 
 * Provides a unified interface for S3 operations that works in both:
 * - Production: Real S3 operations via AWS SDK
 * - Local Development: File system operations when IS_OFFLINE=true
 * 
 * This module does NOT contain business logic - it's a pure storage abstraction.
 */

import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface S3ClientConfig {
  bucketName: string;
  region: string;
  localStoragePath?: string; // For IS_OFFLINE mode
}

export interface S3ObjectMetadata {
  key: string;
  size?: number;
  lastModified?: Date;
  contentType?: string;
  metadata?: Record<string, string>;
}

/**
 * Unified S3 Client Interface
 * Abstracts S3 operations to work with both S3 and local filesystem
 */
export class StorageClient {
  private s3Client: S3Client | null;
  private bucketName: string;
  private region: string;
  private isOffline: boolean;
  private localStoragePath: string;

  constructor(config: S3ClientConfig) {
    this.bucketName = config.bucketName;
    this.region = config.region;
    const storageMode = (process.env.STORAGE_MODE || '').toLowerCase();
    const forceS3 = storageMode === 's3';
    this.isOffline = !forceS3 && process.env.IS_OFFLINE === 'true';
    this.localStoragePath = config.localStoragePath || path.join(process.cwd(), 'local-storage');

    if (this.isOffline) {
      logger.info('StorageClient initialized in offline mode (local filesystem)', {
        localStoragePath: this.localStoragePath,
      });
      this.s3Client = null;
    } else {
      this.s3Client = new S3Client({
        region: this.region,
        // Credentials are automatically injected via IAM role in Lambda
        // or via AWS credentials in local environment
      });
      logger.info('StorageClient initialized in S3 mode', {
        bucket: this.bucketName,
        region: this.region,
      });
    }
  }

  /**
   * Upload a file to storage (S3 or local filesystem)
   * @param key S3 key or local file path
   * @param buffer File content as Buffer
   * @param contentType MIME type
   * @param metadata Optional metadata
   * @returns URL or path to the uploaded file
   */
  async uploadFile(
    key: string,
    buffer: Buffer,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    if (this.isOffline) {
      return this.uploadToLocal(key, buffer);
    }

    return this.uploadToS3(key, buffer, contentType, metadata);
  }

  /**
   * Download a file from storage
   * @param key S3 key or local file path
   * @returns File content as Buffer
   */
  async downloadFile(key: string): Promise<Buffer> {
    if (this.isOffline) {
      return this.downloadFromLocal(key);
    }

    return this.downloadFromS3(key);
  }

  /**
   * Check if a file exists
   * @param key S3 key or local file path
   * @returns True if file exists, false otherwise
   */
  async fileExists(key: string): Promise<boolean> {
    if (this.isOffline) {
      return this.existsInLocal(key);
    }

    return this.existsInS3(key);
  }

  /**
   * Get file metadata
   * @param key S3 key or local file path
   * @returns File metadata
   */
  async getMetadata(key: string): Promise<S3ObjectMetadata> {
    if (this.isOffline) {
      return this.getLocalMetadata(key);
    }

    return this.getS3Metadata(key);
  }

  /**
   * List files in a prefix/directory
   * @param prefix S3 prefix or local directory path
   * @param maxKeys Maximum number of keys to return
   * @returns Array of object keys
   */
  async listFiles(prefix: string, maxKeys: number = 1000): Promise<string[]> {
    if (this.isOffline) {
      return this.listLocalFiles(prefix, maxKeys);
    }

    return this.listS3Files(prefix, maxKeys);
  }

  /**
   * Delete a file
   * @param key S3 key or local file path
   */
  async deleteFile(key: string): Promise<void> {
    if (this.isOffline) {
      return this.deleteLocalFile(key);
    }

    return this.deleteS3File(key);
  }

  // ========== S3 Implementation ==========

  private async uploadToS3(
    key: string,
    buffer: Buffer,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
      });

      await this.s3Client.send(command);

      const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
      logger.debug('File uploaded to S3', { key, size: buffer.length });
      return url;
    } catch (error) {
      logger.error('Error uploading file to S3', { error, key });
      throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async downloadFromS3(key: string): Promise<Buffer> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error('Empty response body from S3');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      // @ts-ignore - Body is a Readable stream
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      logger.debug('File downloaded from S3', { key, size: buffer.length });
      return buffer;
    } catch (error) {
      logger.error('Error downloading file from S3', { error, key });
      throw new Error(`Failed to download file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async existsInS3(key: string): Promise<boolean> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      logger.error('Error checking file existence in S3', { error, key });
      throw error;
    }
  }

  private async getS3Metadata(key: string): Promise<S3ObjectMetadata> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        key,
        size: response.ContentLength,
        lastModified: response.LastModified,
        contentType: response.ContentType,
        metadata: response.Metadata,
      };
    } catch (error) {
      logger.error('Error getting S3 metadata', { error, key });
      throw new Error(`Failed to get S3 metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async listS3Files(prefix: string, maxKeys: number): Promise<string[]> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    try {
      const keys: string[] = [];
      let continuationToken: string | undefined;

      do {
        const command = new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          MaxKeys: maxKeys,
          ContinuationToken: continuationToken,
        });

        const response = await this.s3Client.send(command);

        if (response.Contents) {
          for (const object of response.Contents) {
            if (object.Key) {
              keys.push(object.Key);
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken && keys.length < maxKeys);

      return keys;
    } catch (error) {
      logger.error('Error listing S3 files', { error, prefix });
      throw new Error(`Failed to list S3 files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async deleteS3File(key: string): Promise<void> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      logger.debug('File deleted from S3', { key });
    } catch (error) {
      logger.error('Error deleting S3 file', { error, key });
      throw new Error(`Failed to delete S3 file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ========== Local Filesystem Implementation ==========

  private async uploadToLocal(key: string, buffer: Buffer): Promise<string> {
    try {
      const filePath = path.join(this.localStoragePath, key);
      const dirPath = path.dirname(filePath);

      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true });

      // Write file
      await fs.writeFile(filePath, buffer);

      logger.debug('File uploaded to local storage', { key, filePath, size: buffer.length });
      return filePath;
    } catch (error) {
      logger.error('Error uploading file to local storage', { error, key });
      throw new Error(`Failed to upload file to local storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async downloadFromLocal(key: string): Promise<Buffer> {
    try {
      const filePath = path.join(this.localStoragePath, key);
      const buffer = await fs.readFile(filePath);
      logger.debug('File downloaded from local storage', { key, filePath, size: buffer.length });
      return buffer;
    } catch (error) {
      logger.error('Error downloading file from local storage', { error, key });
      throw new Error(`Failed to download file from local storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async existsInLocal(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.localStoragePath, key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async getLocalMetadata(key: string): Promise<S3ObjectMetadata> {
    try {
      const filePath = path.join(this.localStoragePath, key);
      const stats = await fs.stat(filePath);

      return {
        key,
        size: stats.size,
        lastModified: stats.mtime,
      };
    } catch (error) {
      logger.error('Error getting local metadata', { error, key });
      throw new Error(`Failed to get local metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async listLocalFiles(prefix: string, maxKeys: number): Promise<string[]> {
    try {
      const dirPath = path.join(this.localStoragePath, prefix);
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      const keys: string[] = [];
      for (const entry of entries.slice(0, maxKeys)) {
        if (entry.isFile()) {
          const relativePath = path.join(prefix, entry.name);
          keys.push(relativePath);
        }
      }

      return keys;
    } catch (error) {
      logger.error('Error listing local files', { error, prefix });
      throw new Error(`Failed to list local files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async deleteLocalFile(key: string): Promise<void> {
    try {
      const filePath = path.join(this.localStoragePath, key);
      await fs.unlink(filePath);
      logger.debug('File deleted from local storage', { key, filePath });
    } catch (error) {
      logger.error('Error deleting local file', { error, key });
      throw new Error(`Failed to delete local file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Create a StorageClient instance with default configuration
 */
export function createStorageClient(): StorageClient {
  const bucketName = process.env.S3_BUCKET_NAME || process.env.PARQUET_BUCKET_NAME || '';
  const region = process.env.AWS_REGION || 'us-east-1';
  const localStoragePath = process.env.LOCAL_STORAGE_PATH;

  if (!bucketName && process.env.IS_OFFLINE !== 'true') {
    throw new Error('S3_BUCKET_NAME or PARQUET_BUCKET_NAME environment variable is required');
  }

  return new StorageClient({
    bucketName,
    region,
    localStoragePath,
  });
}

