/**
 * S3 Workflow Test Script
 * 
 * Tests the end-to-end workflow: Project → Structure → Substructure → Borelog
 * Creates test data and verifies each step works with S3
 */

import { createStorageClient } from './src/storage/s3Client';
import { logger } from './src/utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

const results: TestResult[] = [];
let testProjectId: string | null = null;
let testStructureId: string | null = null;
let testSubstructureId: string | null = null;
let testBorelogId: string | null = null;

async function testCreateProject(): Promise<TestResult> {
  try {
    logger.info('[TEST] Creating test project...');
    const projectId = uuidv4();
    const createdAt = new Date();

    const project = {
      id: projectId,
      project_id: projectId,
      name: 'Test Project - S3 Workflow',
      location: 'Test Location',
      created_by: 'test_user',
      created_at: createdAt.toISOString()
    };

    const storageClient = createStorageClient();
    const s3Key = `projects/project_${projectId}/project.json`;
    const projectJson = JSON.stringify(project, null, 2);
    
    await storageClient.uploadFile(
      s3Key,
      Buffer.from(projectJson, 'utf-8'),
      'application/json'
    );

    // Verify it was created
    const exists = await storageClient.fileExists(s3Key);
    if (!exists) {
      return {
        step: 'createProject',
        success: false,
        message: 'Project file not found after creation',
        error: 'File verification failed'
      };
    }

    testProjectId = projectId;
    logger.info(`[TEST] ✓ Project created: ${projectId}`);
    
    return {
      step: 'createProject',
      success: true,
      message: 'Project created successfully',
      data: { project_id: projectId }
    };
  } catch (error) {
    return {
      step: 'createProject',
      success: false,
      message: 'Failed to create project',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function testCreateStructure(projectId: string): Promise<TestResult> {
  try {
    logger.info('[TEST] Creating test structure...');
    const structureId = uuidv4();
    const createdAt = new Date();

    const structure = {
      structure_id: structureId,
      project_id: projectId,
      type: 'Bridge',
      description: 'Test Bridge Structure',
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
      created_by_user_id: 'test_user'
    };

    const storageClient = createStorageClient();
    const s3Key = `projects/project_${projectId}/structures/structure_${structureId}/structure.json`;
    const structureJson = JSON.stringify(structure, null, 2);
    
    await storageClient.uploadFile(
      s3Key,
      Buffer.from(structureJson, 'utf-8'),
      'application/json'
    );

    // Verify it was created
    const exists = await storageClient.fileExists(s3Key);
    if (!exists) {
      return {
        step: 'createStructure',
        success: false,
        message: 'Structure file not found after creation',
        error: 'File verification failed'
      };
    }

    testStructureId = structureId;
    logger.info(`[TEST] ✓ Structure created: ${structureId}`);
    
    return {
      step: 'createStructure',
      success: true,
      message: 'Structure created successfully',
      data: { structure_id: structureId }
    };
  } catch (error) {
    return {
      step: 'createStructure',
      success: false,
      message: 'Failed to create structure',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function testCreateSubstructure(projectId: string, structureId: string): Promise<TestResult> {
  try {
    logger.info('[TEST] Creating test substructure...');
    const substructureId = uuidv4();
    const createdAt = new Date();

    const substructure = {
      substructure_id: substructureId,
      structure_id: structureId,
      project_id: projectId,
      type: 'P1',
      remark: 'Test Substructure',
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
      created_by_user_id: 'test_user'
    };

    const storageClient = createStorageClient();
    const s3Key = `projects/project_${projectId}/structures/structure_${structureId}/substructures/substructure_${substructureId}/substructure.json`;
    const substructureJson = JSON.stringify(substructure, null, 2);
    
    await storageClient.uploadFile(
      s3Key,
      Buffer.from(substructureJson, 'utf-8'),
      'application/json'
    );

    // Verify it was created
    const exists = await storageClient.fileExists(s3Key);
    if (!exists) {
      return {
        step: 'createSubstructure',
        success: false,
        message: 'Substructure file not found after creation',
        error: 'File verification failed'
      };
    }

    testSubstructureId = substructureId;
    logger.info(`[TEST] ✓ Substructure created: ${substructureId}`);
    
    return {
      step: 'createSubstructure',
      success: true,
      message: 'Substructure created successfully',
      data: { substructure_id: substructureId }
    };
  } catch (error) {
    return {
      step: 'createSubstructure',
      success: false,
      message: 'Failed to create substructure',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function testCreateBorelog(projectId: string, substructureId: string): Promise<TestResult> {
  try {
    logger.info('[TEST] Creating test borelog...');
    const borelogId = uuidv4();
    const createdAt = new Date();

    // Create metadata.json
    const metadata = {
      project_id: projectId,
      borelog_id: borelogId,
      substructure_id: substructureId,
      type: 'Geotechnical',
      created_at: createdAt.toISOString(),
      created_by_user_id: 'test_user',
      latest_version: 1,
      versions: [
        {
          version: 1,
          status: 'DRAFT',
          created_by: 'test_user',
          created_at: createdAt.toISOString(),
          number: 'BH-001',
          msl: '100.5',
          boring_method: 'Rotary',
          hole_diameter: 150,
          commencement_date: createdAt.toISOString(),
          completion_date: createdAt.toISOString(),
          standing_water_level: 5.0,
          termination_depth: 20.0
        }
      ]
    };

    const storageClient = createStorageClient();
    const metadataKey = `projects/project_${projectId}/borelogs/borelog_${borelogId}/metadata.json`;
    const metadataJson = JSON.stringify(metadata, null, 2);
    
    await storageClient.uploadFile(
      metadataKey,
      Buffer.from(metadataJson, 'utf-8'),
      'application/json'
    );

    // Verify metadata was created
    const metadataExists = await storageClient.fileExists(metadataKey);
    if (!metadataExists) {
      return {
        step: 'createBorelog',
        success: false,
        message: 'Borelog metadata file not found after creation',
        error: 'Metadata file verification failed'
      };
    }

    testBorelogId = borelogId;
    logger.info(`[TEST] ✓ Borelog created: ${borelogId}`);
    
    return {
      step: 'createBorelog',
      success: true,
      message: 'Borelog created successfully',
      data: { borelog_id: borelogId }
    };
  } catch (error) {
    return {
      step: 'createBorelog',
      success: false,
      message: 'Failed to create borelog',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function testListProjects(): Promise<TestResult> {
  try {
    logger.info('[TEST] Testing listProjects...');
    const storageClient = createStorageClient();
    
    const projectKeys = await storageClient.listFiles('projects/', 10000);
    const projectJsonFiles = projectKeys.filter(k => k.endsWith('/project.json'));
    
    const foundTestProject = projectJsonFiles.some(k => k.includes(testProjectId!));
    
    if (!foundTestProject && testProjectId) {
      return {
        step: 'listProjects',
        success: false,
        message: 'Test project not found in list',
        error: 'Project listing failed'
      };
    }

    logger.info(`[TEST] ✓ Found ${projectJsonFiles.length} projects`);
    
    return {
      step: 'listProjects',
      success: true,
      message: `Found ${projectJsonFiles.length} projects`,
      data: { count: projectJsonFiles.length }
    };
  } catch (error) {
    return {
      step: 'listProjects',
      success: false,
      message: 'Failed to list projects',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function testListStructures(projectId: string): Promise<TestResult> {
  try {
    logger.info('[TEST] Testing listStructures...');
    const storageClient = createStorageClient();
    
    const structuresPrefix = `projects/project_${projectId}/structures/`;
    const allKeys = await storageClient.listFiles(structuresPrefix, 10000);
    const structureKeys = allKeys.filter(key => key.endsWith('/structure.json'));
    
    const foundTestStructure = structureKeys.some(k => k.includes(testStructureId!));
    
    if (!foundTestStructure && testStructureId) {
      return {
        step: 'listStructures',
        success: false,
        message: 'Test structure not found in list',
        error: 'Structure listing failed'
      };
    }

    logger.info(`[TEST] ✓ Found ${structureKeys.length} structures`);
    
    return {
      step: 'listStructures',
      success: true,
      message: `Found ${structureKeys.length} structures`,
      data: { count: structureKeys.length }
    };
  } catch (error) {
    return {
      step: 'listStructures',
      success: false,
      message: 'Failed to list structures',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function testListSubstructures(projectId: string, structureId: string): Promise<TestResult> {
  try {
    logger.info('[TEST] Testing listSubstructures...');
    const storageClient = createStorageClient();
    
    const substructuresPrefix = `projects/project_${projectId}/structures/structure_${structureId}/substructures/`;
    const allKeys = await storageClient.listFiles(substructuresPrefix, 10000);
    const substructureKeys = allKeys.filter(key => key.endsWith('/substructure.json'));
    
    const foundTestSubstructure = substructureKeys.some(k => k.includes(testSubstructureId!));
    
    if (!foundTestSubstructure && testSubstructureId) {
      return {
        step: 'listSubstructures',
        success: false,
        message: 'Test substructure not found in list',
        error: 'Substructure listing failed'
      };
    }

    logger.info(`[TEST] ✓ Found ${substructureKeys.length} substructures`);
    
    return {
      step: 'listSubstructures',
      success: true,
      message: `Found ${substructureKeys.length} substructures`,
      data: { count: substructureKeys.length }
    };
  } catch (error) {
    return {
      step: 'listSubstructures',
      success: false,
      message: 'Failed to list substructures',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function testListBorelogs(projectId: string): Promise<TestResult> {
  try {
    logger.info('[TEST] Testing listBorelogs...');
    const storageClient = createStorageClient();
    
    const borelogsPrefix = `projects/project_${projectId}/borelogs/`;
    const allKeys = await storageClient.listFiles(borelogsPrefix, 10000);
    const metadataKeys = allKeys.filter(key => key.endsWith('/metadata.json'));
    
    const foundTestBorelog = metadataKeys.some(k => k.includes(testBorelogId!));
    
    if (!foundTestBorelog && testBorelogId) {
      return {
        step: 'listBorelogs',
        success: false,
        message: 'Test borelog not found in list',
        error: 'Borelog listing failed'
      };
    }

    logger.info(`[TEST] ✓ Found ${metadataKeys.length} borelogs`);
    
    return {
      step: 'listBorelogs',
      success: true,
      message: `Found ${metadataKeys.length} borelogs`,
      data: { count: metadataKeys.length }
    };
  } catch (error) {
    return {
      step: 'listBorelogs',
      success: false,
      message: 'Failed to list borelogs',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function main() {
  logger.info('[S3 WORKFLOW TEST] Starting end-to-end workflow test...');
  
  // Step 1: Create Project
  const projectResult = await testCreateProject();
  results.push(projectResult);
  if (!projectResult.success) {
    logger.error('[TEST FAILED] Project creation failed');
    printResults();
    process.exit(1);
  }

  // Step 2: Create Structure
  const structureResult = await testCreateStructure(testProjectId!);
  results.push(structureResult);
  if (!structureResult.success) {
    logger.error('[TEST FAILED] Structure creation failed');
    printResults();
    process.exit(1);
  }

  // Step 3: Create Substructure
  const substructureResult = await testCreateSubstructure(testProjectId!, testStructureId!);
  results.push(substructureResult);
  if (!substructureResult.success) {
    logger.error('[TEST FAILED] Substructure creation failed');
    printResults();
    process.exit(1);
  }

  // Step 4: Create Borelog
  const borelogResult = await testCreateBorelog(testProjectId!, testSubstructureId!);
  results.push(borelogResult);
  if (!borelogResult.success) {
    logger.error('[TEST FAILED] Borelog creation failed');
    printResults();
    process.exit(1);
  }

  // Step 5: Test List Operations
  results.push(await testListProjects());
  results.push(await testListStructures(testProjectId!));
  results.push(await testListSubstructures(testProjectId!, testStructureId!));
  results.push(await testListBorelogs(testProjectId!));

  // Final Summary
  printResults();
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  logger.info(`[S3 WORKFLOW VERIFIED]`);
  logger.info(`  projects=${results.find(r => r.step === 'listProjects')?.data?.count || 0}`);
  logger.info(`  structures=${results.find(r => r.step === 'listStructures')?.data?.count || 0}`);
  logger.info(`  substructures=${results.find(r => r.step === 'listSubstructures')?.data?.count || 0}`);
  logger.info(`  borelogs=${results.find(r => r.step === 'listBorelogs')?.data?.count || 0}`);
  
  if (failCount > 0) {
    logger.error(`[TEST FAILED] ${failCount} test(s) failed`);
    process.exit(1);
  } else {
    logger.info('[TEST PASSED] All tests passed!');
    process.exit(0);
  }
}

function printResults() {
  logger.info('\n=== TEST RESULTS ===');
  results.forEach(result => {
    if (result.success) {
      logger.info(`✓ ${result.step}: ${result.message}`);
    } else {
      logger.error(`✗ ${result.step}: ${result.message}`);
      if (result.error) {
        logger.error(`  Error: ${result.error}`);
      }
    }
  });
  logger.info('==================\n');
}

if (require.main === module) {
  main().catch(error => {
    logger.error('[TEST FATAL ERROR]', error);
    process.exit(1);
  });
}

export { testCreateProject, testCreateStructure, testCreateSubstructure, testCreateBorelog };
