import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole } from '../utils/validateInput';
import { logger } from '../utils/logger';
import { insertBorelogImage, getBorelogImages, deleteBorelogImage } from '../models/borelogImages';
import { createResponse } from '../types/common';
import { z } from 'zod';

// Schema for image upload request
const UploadImageSchema = z.object({
  borelog_id: z.string().uuid(),
  image_url: z.string().url()
});

export const uploadImage = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Only Project Manager, Site Engineer, and Admin can upload images
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer'])(event);
    if (authError) {
      return authError;
    }

    if (!event.body) {
      return createResponse(400, {
        success: false,
        message: 'Missing request body',
        error: 'Request body is required'
      });
    }

    const body = JSON.parse(event.body);
    
    // Validate request body
    const validationResult = UploadImageSchema.safeParse(body);
    if (!validationResult.success) {
      return createResponse(400, {
        success: false,
        message: 'Invalid request data',
        error: validationResult.error.errors
      });
    }

    const { borelog_id, image_url } = validationResult.data;

    // Insert image record
    const result = await insertBorelogImage(borelog_id, image_url);

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
