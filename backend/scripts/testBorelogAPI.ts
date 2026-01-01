/**
 * Test the borelog API endpoint to see what it returns
 */

import { createStorageClient } from '../src/storage/s3Client';
import { logger } from '../src/utils/logger';

async function testAPI(projectId: string) {
  const storage = createStorageClient();
  const projectPrefix = `projects/project_${projectId}/`;
  const borelogsPrefix = `${projectPrefix}borelogs/`;
  
  try {
    // Simulate what getBorelogsByProject does
    const allKeys = await storage.listFiles(borelogsPrefix, 10000);
    const metadataKeys = allKeys.filter(key => key.endsWith('/metadata.json'));
    
    logger.info(`API would return ${metadataKeys.length} borelogs for project ${projectId}`);
    
    if (metadataKeys.length > 0) {
      logger.warn('WARNING: Borelogs still exist in S3!');
      metadataKeys.forEach(k => logger.info(`  - ${k}`));
    } else {
      logger.info('✓ No borelogs found - API will return empty array');
    }
    
    return metadataKeys.length;
  } catch (error) {
    logger.error('Error testing API', { error, projectId });
    return -1;
  }
}

const projectId = process.argv[2] || 'c994926c-9fc7-4a2b-911e-90ecaf29c605';

testAPI(projectId)
  .then(count => {
    if (count === 0) {
      logger.info('✓ Confirmed: API will return 0 borelogs');
      logger.info('If UI still shows borelogs, it is cached data. Try:');
      logger.info('  1. Hard refresh (Ctrl+F5)');
      logger.info('  2. Clear browser cache');
      logger.info('  3. Check which project is selected');
    }
    process.exit(0);
  })
  .catch(error => {
    logger.error('Script failed', { error });
    process.exit(1);
  });



