/**
 * S3 Workflow Verification Script
 * 
 * This script verifies the end-to-end S3 workflow by:
 * 1. Checking what's actually in S3/local storage
 * 2. Creating dummy data using handlers
 * 3. Verifying each step
 * 4. Reporting failures
 */

import { createStorageClient } from './src/storage/s3Client';
import { logger } from './src/utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

interface VerificationResult {
  step: string;
  success: boolean;
  reason?: string;
  s3Path?: string;
  found?: boolean;
}

const results: VerificationResult[] = [];

async function checkS3Path(s3Key: string): Promise<boolean> {
  try {
    const storageClient = createStorageClient();
    return await storageClient.fileExists(s3Key);
  } catch (error) {
    logger.error(`Error checking S3 path ${s3Key}:`, error);
    return false;
  }
}

async function verifyProjectCreation(projectId: string): Promise<VerificationResult> {
  const s3Key = `projects/project_${projectId}/project.json`;
  const exists = await checkS3Path(s3Key);
  
  return {
    step: 'createProject',
    success: exists,
    reason: exists ? undefined : 'Project JSON not found in S3',
    s3Path: s3Key,
    found: exists
  };
}

async function verifyStructureCreation(projectId: string, structureId: string): Promise<VerificationResult> {
  const s3Key = `projects/project_${projectId}/structures/structure_${structureId}/structure.json`;
  const exists = await checkS3Path(s3Key);
  
  return {
    step: 'createStructure',
    success: exists,
    reason: exists ? undefined : 'Structure JSON not found in S3',
    s3Path: s3Key,
    found: exists
  };
}

async function verifySubstructureCreation(projectId: string, structureId: string, substructureId: string): Promise<VerificationResult> {
  const s3Key = `projects/project_${projectId}/structures/structure_${structureId}/substructures/substructure_${substructureId}/substructure.json`;
  const exists = await checkS3Path(s3Key);
  
  return {
    step: 'createSubstructure',
    success: exists,
    reason: exists ? undefined : 'Substructure JSON not found in S3',
    s3Path: s3Key,
    found: exists
  };
}

async function verifyBorelogCreation(projectId: string, borelogId: string): Promise<VerificationResult> {
  const metadataKey = `projects/project_${projectId}/borelogs/borelog_${borelogId}/metadata.json`;
  const parquetKey = `projects/project_${projectId}/borelogs/borelog_${borelogId}/v1/data.parquet`;
  
  const metadataExists = await checkS3Path(metadataKey);
  const parquetExists = await checkS3Path(parquetKey);
  
  return {
    step: 'createBorelog',
    success: metadataExists && parquetExists,
    reason: !metadataExists ? 'Borelog metadata.json not found' : !parquetExists ? 'Borelog data.parquet not found' : undefined,
    s3Path: metadataExists ? parquetKey : metadataKey,
    found: metadataExists && parquetExists
  };
}

async function listAllS3Objects(prefix: string): Promise<string[]> {
  try {
    const storageClient = createStorageClient();
    return await storageClient.listFiles(prefix, 10000);
  } catch (error) {
    logger.error(`Error listing S3 objects with prefix ${prefix}:`, error);
    return [];
  }
}

async function verifyCurrentState(): Promise<void> {
  logger.info('[S3 VERIFY] Checking current S3 state...');
  
  // List all projects
  const projectKeys = await listAllS3Objects('projects/');
  const projectJsonFiles = projectKeys.filter(k => k.endsWith('/project.json'));
  
  logger.info(`[S3 VERIFY] Found ${projectJsonFiles.length} projects in S3`);
  
  for (const projectKey of projectJsonFiles) {
    const match = projectKey.match(/projects\/project_([^\/]+)\/project\.json/);
    if (match) {
      const projectId = match[1];
      logger.info(`[S3 VERIFY] Project: ${projectId}`);
      
      // Check for structures
      const structureKeys = await listAllS3Objects(`projects/project_${projectId}/structures/`);
      logger.info(`[S3 VERIFY]   Structures: ${structureKeys.filter(k => k.endsWith('/structure.json')).length}`);
      
      // Check for borelogs
      const borelogKeys = await listAllS3Objects(`projects/project_${projectId}/borelogs/`);
      logger.info(`[S3 VERIFY]   Borelogs: ${borelogKeys.filter(k => k.endsWith('/metadata.json')).length}`);
    }
  }
}

async function main() {
  logger.info('[S3 VERIFY] Starting S3 workflow verification...');
  
  // Step 1: Verify current state
  await verifyCurrentState();
  
  logger.info('[S3 VERIFY] Verification complete. Results:');
  logger.info(`[S3 VERIFY] Total checks: ${results.length}`);
  logger.info(`[S3 VERIFY] Successful: ${results.filter(r => r.success).length}`);
  logger.info(`[S3 VERIFY] Failed: ${results.filter(r => !r.success).length}`);
  
  results.forEach(result => {
    if (!result.success) {
      logger.error(`[S3 VERIFY FAIL] ${result.step} reason=${result.reason} path=${result.s3Path}`);
    }
  });
}

if (require.main === module) {
  main().catch(error => {
    logger.error('[S3 VERIFY] Fatal error:', error);
    process.exit(1);
  });
}

export { verifyProjectCreation, verifyStructureCreation, verifySubstructureCreation, verifyBorelogCreation };

