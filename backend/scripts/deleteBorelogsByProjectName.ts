/**
 * Script to delete all borelogs for a project by project name
 * Usage: npx ts-node scripts/deleteBorelogsByProjectName.ts "test-project 2"
 */

import { createStorageClient } from '../src/storage/s3Client';
import { logger } from '../src/utils/logger';

async function findProjectIdByName(projectName: string): Promise<string | null> {
  const storage = createStorageClient();
  const projectKeys = (await storage.listFiles('projects/', 20000))
    .filter(k => k.endsWith('/project.json'));

  logger.info(`Searching through ${projectKeys.length} projects...`);
  
  const normalizedSearchName = projectName.toLowerCase().trim();
  
  for (const key of projectKeys) {
    try {
      const buf = await storage.downloadFile(key);
      const project = JSON.parse(buf.toString('utf-8'));
      const projectNameNormalized = project?.name?.toLowerCase().trim() || '';
      
      // Try exact match or contains match
      if (projectNameNormalized === normalizedSearchName || 
          projectNameNormalized.includes(normalizedSearchName) ||
          normalizedSearchName.includes(projectNameNormalized)) {
        let projectId = project.project_id;
        if (!projectId) {
          // Extract from path if not in content
          const parts = key.split('/');
          const folder = parts[1];
          projectId = folder.startsWith('project_') ? folder.replace('project_', '') : folder;
        }
        logger.info(`Found project: "${project.name}" (ID: ${projectId})`);
        return projectId;
      }
    } catch (err) {
      logger.warn('Failed to parse project.json', { key, err });
    }
  }
  
  // List all projects for debugging
  logger.info('Available projects:');
  for (const key of projectKeys.slice(0, 10)) {
    try {
      const buf = await storage.downloadFile(key);
      const project = JSON.parse(buf.toString('utf-8'));
      logger.info(`  - "${project?.name}"`);
    } catch {
      // Skip
    }
  }

  return null;
}

async function listBorelogsForProject(projectId: string): Promise<string[]> {
  const storage = createStorageClient();
  const borelogsPrefix = `projects/project_${projectId}/borelogs/`;
  
  try {
    const allKeys = await storage.listFiles(borelogsPrefix, 10000);
    const metadataKeys = allKeys.filter(key => 
      key.endsWith('/metadata.json') && 
      key.includes('/borelogs/borelog_') &&
      !key.includes('/versions/') &&
      !key.includes('/parsed/')
    );
    
    const borelogIds: string[] = [];
    for (const key of metadataKeys) {
      try {
        const buf = await storage.downloadFile(key);
        const meta = JSON.parse(buf.toString('utf-8'));
        if (meta?.borelog_id) {
          borelogIds.push(meta.borelog_id);
        }
      } catch (err) {
        logger.warn('Failed to parse borelog metadata', { key, err });
      }
    }
    
    return borelogIds;
  } catch (error) {
    logger.error('Error listing borelogs', { error, projectId });
    return [];
  }
}

async function deleteBorelogFiles(basePath: string): Promise<number> {
  const storage = createStorageClient();
  const allFiles = await storage.listFiles(basePath, 10000);
  
  if (allFiles.length === 0) {
    logger.info(`No files found at ${basePath}`);
    return 0;
  }
  
  logger.info(`Deleting ${allFiles.length} files from ${basePath}`);
  
  // Delete all files in parallel
  const deletePromises = allFiles.map(file => 
    storage.deleteFile(file).catch(err => {
      logger.warn('Failed to delete file', { file, error: err });
      return false;
    })
  );
  
  const results = await Promise.all(deletePromises);
  const successCount = results.filter(r => r !== false).length;
  
  logger.info(`Deleted ${successCount}/${allFiles.length} files from ${basePath}`);
  return successCount;
}

async function deleteAllBorelogsForProject(projectName: string): Promise<void> {
  logger.info(`Starting deletion of borelogs for project: ${projectName}`);
  
  // Find project ID
  const projectId = await findProjectIdByName(projectName);
  if (!projectId) {
    logger.error(`Project not found: ${projectName}`);
    process.exit(1);
  }
  
  logger.info(`Found project ID: ${projectId}`);
  
  // List all borelogs
  const borelogIds = await listBorelogsForProject(projectId);
  logger.info(`Found ${borelogIds.length} borelogs to delete`);
  
  if (borelogIds.length === 0) {
    logger.info('No borelogs found to delete');
    return;
  }
  
  // Delete each borelog
  let deletedCount = 0;
  for (const borelogId of borelogIds) {
    const basePath = `projects/project_${projectId}/borelogs/borelog_${borelogId}/`;
    logger.info(`Deleting borelog: ${borelogId}`);
    const count = await deleteBorelogFiles(basePath);
    deletedCount += count;
  }
  
  logger.info(`Completed deletion: ${deletedCount} files deleted across ${borelogIds.length} borelogs`);
}

// Main execution
const projectName = process.argv[2] || 'test-project 2';

deleteAllBorelogsForProject(projectName)
  .then(() => {
    logger.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    console.error('Error details:', error);
    process.exit(1);
  });

