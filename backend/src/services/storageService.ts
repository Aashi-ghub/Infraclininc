import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Storage service abstraction layer for file storage
 * Supports S3 in production and local filesystem/mocked URLs in development
 */
export interface StorageService {
  uploadFile(
    buffer: Buffer,
    key: string,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<string>;
  
  getPublicOrSignedUrl(key: string, expiresIn?: number): Promise<string>;
}

/**
 * File size limits (in bytes)
 */
export const FILE_SIZE_LIMITS = {
  CSV: 10 * 1024 * 1024, // 10 MB
  IMAGE: 5 * 1024 * 1024, // 5 MB
  PDF: 10 * 1024 * 1024, // 10 MB
} as const;

/**
 * Allowed MIME types
 */
export const ALLOWED_MIME_TYPES = {
  CSV: [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ],
  IMAGE: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ],
  PDF: [
    'application/pdf',
  ],
} as const;

/**
 * Validate file size and MIME type
 */
export function validateFile(
  buffer: Buffer,
  mimeType: string,
  fileType: 'CSV' | 'IMAGE' | 'PDF'
): { valid: boolean; error?: string } {
  const sizeLimit = FILE_SIZE_LIMITS[fileType];
  const allowedTypes = ALLOWED_MIME_TYPES[fileType];

  if (buffer.length > sizeLimit) {
    return {
      valid: false,
      error: `File size exceeds limit. Maximum size for ${fileType} is ${sizeLimit / (1024 * 1024)} MB`,
    };
  }

  if (!allowedTypes.includes(mimeType.toLowerCase())) {
    return {
      valid: false,
      error: `Invalid MIME type. Allowed types for ${fileType}: ${allowedTypes.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Generate deterministic S3 key for file storage
 * Format: projects/{project_id}/borelogs/{borelog_id}/{file_type}/filename
 */
export function generateS3Key(
  projectId: string,
  borelogId: string,
  fileType: 'csv' | 'image' | 'pdf' | 'lab_report',
  originalFilename: string
): string {
  // Extract extension from filename
  const extension = originalFilename.split('.').pop() || '';
  // Generate unique filename with timestamp to prevent overwrites
  const timestamp = Date.now();
  const uniqueId = uuidv4().substring(0, 8);
  const sanitizedFilename = originalFilename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/\.[^.]*$/, ''); // Remove extension
  
  const filename = `${sanitizedFilename}_${timestamp}_${uniqueId}.${extension}`;
  
  return `projects/${projectId}/borelogs/${borelogId}/${fileType}/${filename}`;
}

/**
 * S3 Storage Service Implementation
 */
class S3StorageService implements StorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucketName = process.env.S3_BUCKET_NAME || '';

    if (!this.bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is required');
    }

    this.s3Client = new S3Client({
      region: this.region,
      // Credentials are automatically injected via IAM role in Lambda
      // or via AWS credentials in local environment
    });

    logger.info('S3 Storage Service initialized', {
      region: this.region,
      bucket: this.bucketName,
    });
  }

  async uploadFile(
    buffer: Buffer,
    key: string,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        Metadata: metadata || {},
      });

      await this.s3Client.send(command);

      // Return S3 object URL
      const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
      
      logger.info('File uploaded to S3', {
        key,
        size: buffer.length,
        mimeType,
      });

      return url;
    } catch (error) {
      logger.error('Error uploading file to S3', { error, key });
      throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPublicOrSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      // Extract key from full URL if provided
      let s3Key = key;
      if (key.includes('amazonaws.com/')) {
        const parts = key.split('amazonaws.com/');
        s3Key = parts.length > 1 ? parts[1] : key;
      } else if (key.startsWith('https://') || key.startsWith('http://')) {
        // Extract path from any URL
        try {
          const url = new URL(key);
          s3Key = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
        } catch {
          // If URL parsing fails, use key as-is
          s3Key = key;
        }
      }

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      
      logger.debug('Generated signed URL', { key: s3Key, expiresIn });
      
      return url;
    } catch (error) {
      logger.error('Error generating signed URL', { error, key });
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Mock Storage Service for local development
 */
class MockStorageService implements StorageService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.MOCK_STORAGE_BASE_URL || 'https://mock-storage.local';
    logger.info('Mock Storage Service initialized (IS_OFFLINE mode)', {
      baseUrl: this.baseUrl,
    });
  }

  async uploadFile(
    buffer: Buffer,
    key: string,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    // In offline mode, just return a mock URL
    // In a real implementation, you might want to save to local filesystem
    const mockUrl = `${this.baseUrl}/${key}`;
    
    logger.info('Mock file upload (offline mode)', {
      key,
      size: buffer.length,
      mimeType,
      mockUrl,
    });

    // TODO: Optionally save to local filesystem for testing
    // const fs = require('fs');
    // const path = require('path');
    // const localPath = path.join(__dirname, '../../local-storage', key);
    // await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
    // await fs.promises.writeFile(localPath, buffer);

    return mockUrl;
  }

  async getPublicOrSignedUrl(key: string, expiresIn?: number): Promise<string> {
    // Extract key from full URL if provided
    const s3Key = key.includes('amazonaws.com/') 
      ? key.split('amazonaws.com/')[1] 
      : key.includes('/') && !key.startsWith('http')
        ? key
        : key.split('/').pop() || key;

    const mockUrl = `${this.baseUrl}/${s3Key}`;
    
    logger.debug('Mock signed URL generated (offline mode)', {
      key: s3Key,
      mockUrl,
    });

    return mockUrl;
  }
}

/**
 * Get storage service instance based on environment
 */
let storageServiceInstance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (storageServiceInstance) {
    return storageServiceInstance;
  }

  const isOffline = process.env.IS_OFFLINE === 'true';

  if (isOffline) {
    storageServiceInstance = new MockStorageService();
  } else {
    storageServiceInstance = new S3StorageService();
  }

  return storageServiceInstance;
}

// Export default instance getter
export default getStorageService;

