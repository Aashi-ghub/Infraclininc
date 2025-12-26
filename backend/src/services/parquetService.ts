/**
 * Parquet Service
 * 
 * Service layer for invoking Python Parquet Lambda.
 * Replaces direct PostgreSQL queries with Lambda invocations.
 */

import { Lambda } from 'aws-sdk';
import { logger } from '../utils/logger';
import * as db from '../db';

const lambda = new Lambda({
  region: process.env.AWS_REGION || 'us-east-1',
});

const PARQUET_LAMBDA_FUNCTION_NAME = process.env.PARQUET_LAMBDA_FUNCTION_NAME || 'parquet-repository';

/**
 * Get project_id from project_name
 * Helper function for entities that use project_name instead of project_id
 * 
 * NOTE: This function requires database access. When DB is disabled,
 * it will return null and log a warning.
 */
export async function getProjectIdFromName(projectName: string): Promise<string | null> {
  // Guard: Check if DB is enabled
  if (!db.isDbEnabled()) {
    logger.warn('[DB DISABLED] getProjectIdFromName called but DB is disabled');
    return null;
  }

  try {
    const query = `SELECT project_id FROM projects WHERE name = $1 LIMIT 1`;
    const result = await db.query<{ project_id: string }>(query, [projectName]);
    return result.length > 0 ? result[0].project_id : null;
  } catch (error) {
    logger.error('Error getting project_id from project_name:', error);
    return null;
  }
}

/**
 * Get project_id from borelog_id
 * Helper function for geological logs
 * 
 * NOTE: This function requires database access. When DB is disabled,
 * it will return null and log a warning.
 */
export async function getProjectIdFromBorelogId(borelogId: string): Promise<string | null> {
  // Guard: Check if DB is enabled
  if (!db.isDbEnabled()) {
    logger.warn('[DB DISABLED] getProjectIdFromBorelogId called but DB is disabled');
    return null;
  }

  try {
    const query = `
      SELECT project_id 
      FROM boreloge 
      WHERE borelog_id = $1 
      LIMIT 1
    `;
    const result = await db.query<{ project_id: string }>(query, [borelogId]);
    return result.length > 0 ? result[0].project_id : null;
  } catch (error) {
    logger.error('Error getting project_id from borelog_id:', error);
    return null;
  }
}

/**
 * Entity type mapping from Node.js to Python
 */
export enum ParquetEntityType {
  BORELOG = 'borelog',
  GEOLOGICAL_LOG = 'geological_log',
  LAB_TEST = 'lab_test',
}

/**
 * Invoke Python Parquet Lambda
 */
async function invokeParquetLambda(payload: any): Promise<any> {
  try {
    const params: Lambda.InvocationRequest = {
      FunctionName: PARQUET_LAMBDA_FUNCTION_NAME,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(payload),
    };

    const result = await lambda.invoke(params).promise();

    if (result.FunctionError) {
      logger.error('Lambda function error:', result.FunctionError);
      throw new Error(`Lambda function error: ${result.FunctionError}`);
    }

    const response = JSON.parse(result.Payload as string);
    
    // Handle API Gateway response format
    if (response.statusCode) {
      const body = JSON.parse(response.body);
      if (response.statusCode >= 400) {
        throw new Error(body.error || 'Lambda invocation failed');
      }
      return body.data || body;
    }

    return response;
  } catch (error) {
    logger.error('Error invoking Parquet Lambda:', error);
    throw error;
  }
}

/**
 * Create entity in Parquet storage
 */
export async function createParquetEntity(
  entityType: ParquetEntityType,
  projectId: string,
  entityId: string,
  payload: any,
  user: string,
  comment?: string
): Promise<any> {
  const lambdaPayload = {
    action: 'create',
    entity_type: entityType,
    project_id: projectId,
    entity_id: entityId,
    payload: payload,
    user: user,
    comment: comment,
  };

  return invokeParquetLambda(lambdaPayload);
}

/**
 * Update entity in Parquet storage
 */
export async function updateParquetEntity(
  entityType: ParquetEntityType,
  projectId: string,
  entityId: string,
  payload: any,
  user: string,
  comment?: string
): Promise<any> {
  const lambdaPayload = {
    action: 'update',
    entity_type: entityType,
    project_id: projectId,
    entity_id: entityId,
    payload: payload,
    user: user,
    comment: comment,
  };

  return invokeParquetLambda(lambdaPayload);
}

/**
 * Get latest version of entity
 */
export async function getParquetEntity(
  entityType: ParquetEntityType,
  projectId: string,
  entityId: string
): Promise<any | null> {
  const lambdaPayload = {
    action: 'get',
    entity_type: entityType,
    project_id: projectId,
    entity_id: entityId,
  };

  try {
    return await invokeParquetLambda(lambdaPayload);
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('404')) {
      return null;
    }
    throw error;
  }
}

/**
 * List entities by project
 */
export async function listParquetEntities(
  entityType: ParquetEntityType,
  projectId: string,
  status?: string
): Promise<any[]> {
  const lambdaPayload: any = {
    action: 'list',
    entity_type: entityType,
    project_id: projectId,
  };

  if (status) {
    lambdaPayload.status = status;
  }

  const result = await invokeParquetLambda(lambdaPayload);
  return result || [];
}

/**
 * Approve entity
 */
export async function approveParquetEntity(
  entityType: ParquetEntityType,
  projectId: string,
  entityId: string,
  approver: string,
  comment?: string
): Promise<any> {
  const lambdaPayload = {
    action: 'approve',
    entity_type: entityType,
    project_id: projectId,
    entity_id: entityId,
    approver: approver,
    comment: comment,
  };

  return invokeParquetLambda(lambdaPayload);
}

/**
 * Reject entity
 */
export async function rejectParquetEntity(
  entityType: ParquetEntityType,
  projectId: string,
  entityId: string,
  rejector: string,
  comment?: string
): Promise<any> {
  const lambdaPayload = {
    action: 'reject',
    entity_type: entityType,
    project_id: projectId,
    entity_id: entityId,
    rejector: rejector,
    comment: comment,
  };

  return invokeParquetLambda(lambdaPayload);
}

/**
 * Get specific version of entity
 */
export async function getParquetEntityVersion(
  entityType: ParquetEntityType,
  projectId: string,
  entityId: string,
  version: number
): Promise<any | null> {
  const lambdaPayload = {
    action: 'get_version',
    entity_type: entityType,
    project_id: projectId,
    entity_id: entityId,
    version: version,
  };

  try {
    return await invokeParquetLambda(lambdaPayload);
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('404')) {
      return null;
    }
    throw error;
  }
}

/**
 * Get entity history
 */
export async function getParquetEntityHistory(
  entityType: ParquetEntityType,
  projectId: string,
  entityId: string
): Promise<any[]> {
  const lambdaPayload = {
    action: 'get_history',
    entity_type: entityType,
    project_id: projectId,
    entity_id: entityId,
  };

  const result = await invokeParquetLambda(lambdaPayload);
  return result || [];
}

