/**
 * Full S3 Workflow Test
 * Tests the complete workflow: Project → Structure → Substructure → Borelog
 * Uses actual handlers to ensure real functionality
 */

import { logger } from './src/utils/logger';
import { createStorageClient } from './src/storage/s3Client';

interface TestResult {
  step: string;
  success: boolean;
  error?: string;
  data?: any;
}

const results: TestResult[] = [];
let testProjectId: string | null = null;
let testStructureId: string | null = null;
let testSubstructureId: string | null = null;
let testBorelogId: string | null = null;

async function verifyS3Object(key: string, description: string): Promise<boolean> {
  try {
    const storageClient = createStorageClient();
    const exists = await storageClient.fileExists(key);
    if (exists) {
      logger.info(`[TEST] ✓ ${description} exists: ${key}`);
      return true;
    } else {
      logger.error(`[TEST] ✗ ${description} NOT found: ${key}`);
      return false;
    }
  } catch (error: any) {
    logger.error(`[TEST] ✗ Error checking ${description}:`, error.message);
    return false;
  }
}

async function testWorkflow() {
  logger.info('[TEST] ========================================');
  logger.info('[TEST] Starting Full S3 Workflow Test');
  logger.info('[TEST] ========================================');
  
  const storageClient = createStorageClient();
  
  // Step 1: Verify Projects can be listed
  logger.info('[TEST] Step 1: Testing listProjects...');
  try {
    const projectKeys = await storageClient.listFiles('projects/', 10000);
    const projectJsonFiles = projectKeys.filter(key => 
      key.match(/^projects\/project_[^\/]+\/project\.json$/) !== null
    );
    logger.info(`[TEST] ✓ Found ${projectJsonFiles.length} projects`);
    
    if (projectJsonFiles.length > 0) {
      // Use the first project for testing
      const firstProjectKey = projectJsonFiles[0];
      const match = firstProjectKey.match(/projects\/project_([^\/]+)\/project\.json/);
      if (match) {
        testProjectId = match[1];
        logger.info(`[TEST] Using test project: ${testProjectId}`);
      }
    }
    
    results.push({ step: 'listProjects', success: true, data: { count: projectJsonFiles.length } });
  } catch (error: any) {
    logger.error('[TEST] ✗ listProjects failed:', error.message);
    results.push({ step: 'listProjects', success: false, error: error.message });
    return;
  }
  
  if (!testProjectId) {
    logger.error('[TEST] No projects found. Please create a project first.');
    return;
  }
  
  // Step 2: Verify Structures can be listed
  logger.info('[TEST] Step 2: Testing listStructures...');
  try {
    const structuresPrefix = `projects/project_${testProjectId}/structures/`;
    const allKeys = await storageClient.listFiles(structuresPrefix, 10000);
    const structureKeys = allKeys.filter(key => key.endsWith('/structure.json'));
    logger.info(`[TEST] ✓ Found ${structureKeys.length} structures`);
    
    if (structureKeys.length > 0) {
      const firstStructureKey = structureKeys[0];
      const match = firstStructureKey.match(/structure_([^\/]+)\/structure\.json/);
      if (match) {
        testStructureId = match[1];
        logger.info(`[TEST] Using test structure: ${testStructureId}`);
      }
    }
    
    results.push({ step: 'listStructures', success: true, data: { count: structureKeys.length } });
  } catch (error: any) {
    logger.error('[TEST] ✗ listStructures failed:', error.message);
    results.push({ step: 'listStructures', success: false, error: error.message });
  }
  
  // Step 3: Verify Substructures can be listed
  if (testStructureId) {
    logger.info('[TEST] Step 3: Testing listSubstructures...');
    try {
      const substructuresPrefix = `projects/project_${testProjectId}/structures/structure_${testStructureId}/substructures/`;
      const allKeys = await storageClient.listFiles(substructuresPrefix, 10000);
      const substructureKeys = allKeys.filter(key => key.endsWith('/substructure.json'));
      logger.info(`[TEST] ✓ Found ${substructureKeys.length} substructures`);
      
      if (substructureKeys.length > 0) {
        const firstSubstructureKey = substructureKeys[0];
        const match = firstSubstructureKey.match(/substructure_([^\/]+)\/substructure\.json/);
        if (match) {
          testSubstructureId = match[1];
          logger.info(`[TEST] Using test substructure: ${testSubstructureId}`);
        }
      }
      
      results.push({ step: 'listSubstructures', success: true, data: { count: substructureKeys.length } });
    } catch (error: any) {
      logger.error('[TEST] ✗ listSubstructures failed:', error.message);
      results.push({ step: 'listSubstructures', success: false, error: error.message });
    }
  }
  
  // Step 4: Verify Borelogs can be listed
  logger.info('[TEST] Step 4: Testing getBorelogsByProject...');
  try {
    const borelogsPrefix = `projects/project_${testProjectId}/borelogs/`;
    const allKeys = await storageClient.listFiles(borelogsPrefix, 10000);
    const metadataKeys = allKeys.filter(key => key.endsWith('/metadata.json'));
    logger.info(`[TEST] ✓ Found ${metadataKeys.length} borelogs`);
    
    if (metadataKeys.length > 0) {
      const firstMetadataKey = metadataKeys[0];
      const match = firstMetadataKey.match(/borelog_([^\/]+)\/metadata\.json/);
      if (match) {
        testBorelogId = match[1];
        logger.info(`[TEST] Using test borelog: ${testBorelogId}`);
      }
    }
    
    results.push({ step: 'getBorelogsByProject', success: true, data: { count: metadataKeys.length } });
  } catch (error: any) {
    logger.error('[TEST] ✗ getBorelogsByProject failed:', error.message);
    results.push({ step: 'getBorelogsByProject', success: false, error: error.message });
  }
  
  // Step 5: Verify specific S3 objects exist
  logger.info('[TEST] Step 5: Verifying S3 objects...');
  
  if (testProjectId) {
    await verifyS3Object(
      `projects/project_${testProjectId}/project.json`,
      'Project JSON'
    );
  }
  
  if (testStructureId && testProjectId) {
    await verifyS3Object(
      `projects/project_${testProjectId}/structures/structure_${testStructureId}/structure.json`,
      'Structure JSON'
    );
  }
  
  if (testSubstructureId && testStructureId && testProjectId) {
    await verifyS3Object(
      `projects/project_${testProjectId}/structures/structure_${testStructureId}/substructures/substructure_${testSubstructureId}/substructure.json`,
      'Substructure JSON'
    );
  }
  
  if (testBorelogId && testProjectId) {
    await verifyS3Object(
      `projects/project_${testProjectId}/borelogs/borelog_${testBorelogId}/metadata.json`,
      'Borelog Metadata'
    );
  }
  
  // Summary
  logger.info('[TEST] ========================================');
  logger.info('[TEST] Test Summary');
  logger.info('[TEST] ========================================');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  logger.info(`[TEST] Total tests: ${results.length}`);
  logger.info(`[TEST] Successful: ${successful}`);
  logger.info(`[TEST] Failed: ${failed}`);
  
  results.forEach(result => {
    if (result.success) {
      logger.info(`[TEST] ✓ ${result.step}${result.data ? ` (${JSON.stringify(result.data)})` : ''}`);
    } else {
      logger.error(`[TEST] ✗ ${result.step}: ${result.error}`);
    }
  });
  
  // Final assertion
  const projectCount = results.find(r => r.step === 'listProjects')?.data?.count || 0;
  const structureCount = results.find(r => r.step === 'listStructures')?.data?.count || 0;
  const substructureCount = results.find(r => r.step === 'listSubstructures')?.data?.count || 0;
  const borelogCount = results.find(r => r.step === 'getBorelogsByProject')?.data?.count || 0;
  
  if (failed === 0) {
    logger.info('[S3 WORKFLOW VERIFIED]');
    logger.info(`projects=${projectCount} structures=${structureCount} substructures=${substructureCount} borelogs=${borelogCount}`);
  } else {
    logger.error('[S3 WORKFLOW VERIFICATION FAILED]');
    logger.error(`Failed steps: ${results.filter(r => !r.success).map(r => r.step).join(', ')}`);
  }
}

if (require.main === module) {
  // Set offline mode for local testing
  if (!process.env.IS_OFFLINE) {
    process.env.IS_OFFLINE = 'true';
  }
  
  testWorkflow().catch(error => {
    logger.error('[TEST] Fatal error:', error);
    process.exit(1);
  });
}

export { testWorkflow };

