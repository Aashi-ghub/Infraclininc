import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger } from '../utils/logger';
import { insertBorelogImage, getBorelogImages, deleteBorelogImage } from '../models/borelogImages';
import { createResponse } from '../types/common';
import { z } from 'zod';
import { getStorageService, validateFile, generateS3Key } from '../services/storageService';
import * as db from '../db';
import { guardDbRoute } from '../db';
import { parseBody } from '../utils/parseBody';

// Schema for image upload request - supports both file upload and URL
const UploadImageSchema = z.object({
  borelog_id: z.string().uuid(),
  image_url: z.string().url().optional(), // For backward compatibility
  image_data: z.string().optional(), // Base64 encoded image data
  file_name: z.string().optional(), // Original filename
  project_id: z.string().uuid().optional(), // Required if uploading file
});

export const uploadImage = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('uploadImage');
  if (dbGuard) return dbGuard;

  try {
    // Only Project Manager, Site Engineer, and Admin can upload images
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer'])(event);
    if (authError) {
      return authError;
    }

    // Get user info for project lookup if needed
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = await validateToken(authHeader!);

    if (!event.body) {
      return createResponse(400, {
        success: false,
        message: 'Missing request body',
        error: 'Request body is required'
      });
    }

    const body = parseBody(event);
    if (!body) {
      return createResponse(400, { success: false, message: "Invalid JSON body" });
    }
    
    // Validate request body
    const validationResult = UploadImageSchema.safeParse(body);
    if (!validationResult.success) {
      return createResponse(400, {
        success: false,
        message: 'Invalid request data',
        error: validationResult.error.errors
      });
    }

    const { borelog_id, image_url, image_data, file_name, project_id } = validationResult.data;

    let finalImageUrl: string;

    // If image_data is provided, upload to S3
    if (image_data) {
      try {
        // Decode base64 image data
        const imageBuffer = Buffer.from(image_data, 'base64');

        // Determine MIME type from file extension or default to image/jpeg
        let mimeType = 'image/jpeg';
        if (file_name) {
          const ext = file_name.toLowerCase().split('.').pop();
          if (ext === 'png') mimeType = 'image/png';
          else if (ext === 'gif') mimeType = 'image/gif';
          else if (ext === 'webp') mimeType = 'image/webp';
        }

        // Validate file size and MIME type
        const validation = validateFile(imageBuffer, mimeType, 'IMAGE');
        if (!validation.valid) {
          return createResponse(400, {
            success: false,
            message: 'File validation failed',
            error: validation.error
          });
        }

        // Get project_id from borelog if not provided
        let projectId = project_id;
        if (!projectId && borelog_id) {
          const pool = await db.getPool();
          const result = await pool.query(
            'SELECT project_id FROM boreloge WHERE borelog_id = $1',
            [borelog_id]
          );
          if (result.rows.length > 0) {
            projectId = result.rows[0].project_id;
          }
        }

        if (!projectId) {
          return createResponse(400, {
            success: false,
            message: 'project_id is required when uploading file data',
            error: 'Cannot determine project_id for S3 key generation'
          });
        }

        // Generate S3 key
        const s3Key = generateS3Key(
          projectId,
          borelog_id,
          'image',
          file_name || `image_${Date.now()}.jpg`
        );

        // Upload to S3
        const storageService = getStorageService();
        finalImageUrl = await storageService.uploadFile(
          imageBuffer,
          s3Key,
          mimeType,
          {
            borelog_id: borelog_id,
            project_id: projectId,
          }
        );

        logger.info('Image uploaded to S3', { finalImageUrl, s3Key });
      } catch (error) {
        logger.error('Error uploading image to S3:', error);
        return createResponse(500, {
          success: false,
          message: 'Failed to upload image to S3',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else if (image_url) {
      // Backward compatibility: use provided URL
      finalImageUrl = image_url;
      logger.info('Using provided image URL (backward compatibility)', { image_url });
    } else {
      return createResponse(400, {
        success: false,
        message: 'Either image_url or image_data must be provided',
        error: 'Missing image data'
      });
    }

    // Insert image record
    const result = await insertBorelogImage(borelog_id, finalImageUrl);

    return createResponse(201, {
      success: true,
      message: 'Image uploaded successfully',
      data: result
    });

  } catch (error) {
    logger.error('Error uploading image:', error);
    return createResponse(500, {
      success: false,
      message: 'Failed to upload image',
      error: 'Internal server error'
    });
  }
};

export const getImages = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('getImages');
  if (dbGuard) return dbGuard;

  try {
    const borelog_id = event.pathParameters?.borelog_id;

    if (!borelog_id) {
      return createResponse(400, {
        success: false,
        message: 'Missing borelog_id parameter',
        error: 'borelog_id is required'
      });
    }

    const images = await getBorelogImages(borelog_id);

    return createResponse(200, {
      success: true,
      message: 'Images retrieved successfully',
      data: images
    });

  } catch (error) {
    logger.error('Error getting images:', error);
    return createResponse(500, {
      success: false,
      message: 'Failed to get images',
      error: 'Internal server error'
    });
  }
};

export const deleteImage = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Guard: Check if DB is enabled
  const dbGuard = guardDbRoute('deleteImage');
  if (dbGuard) return dbGuard;

  try {
    // Only Project Manager and Admin can delete images
    const authError = await checkRole(['Admin', 'Project Manager'])(event);
    if (authError) {
      return authError;
    }

    const image_id = event.pathParameters?.image_id;

    if (!image_id) {
      return createResponse(400, {
        success: false,
        message: 'Missing image_id parameter',
        error: 'image_id is required'
      });
    }

    const success = await deleteBorelogImage(image_id);

    if (!success) {
      return createResponse(404, {
        success: false,
        message: 'Image not found',
        error: 'Image does not exist'
      });
    }

    return createResponse(200, {
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting image:', error);
    return createResponse(500, {
      success: false,
      message: 'Failed to delete image',
      error: 'Internal server error'
    });
  }
};
