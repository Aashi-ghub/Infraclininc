/**
 * Script to check what borelogs exist in S3 for a project
 */

import { createStorageClient } from '../src/storage/s3Client';
import { logger } from '../src/utils/logger';

async function checkBorelogs(projectId: string) {
  const storage = createStorageClient();
  const prefix = `projects/project_${projectId}/borelogs/`;
  
  try {
    const allKeys = await storage.listFiles(prefix, 10000);
    const metadataKeys = allKeys.filter(k => 
      k.endsWith('/metadata.json') && 
      k.includes('/borelogs/borelog_') &&
      !k.includes('/versions/') &&
      !k.includes('/parsed/')
    );
    
    logger.info(`Found ${metadataKeys.length} borelog metadata files for project ${projectId}`);
    
    for (const key of metadataKeys) {
      try {
        const buf = await storage.downloadFile(key);
        const meta = JSON.parse(buf.toString('utf-8'));
        logger.info(`  - Borelog ID: ${meta.borelog_id}, Number: ${meta.number || 'N/A'}`);
      } catch (err) {
        logger.warn(`  - Failed to read ${key}`);
      }
    }
    
    return metadataKeys.length;
  } catch (error) {
    logger.error('Error checking borelogs', { error, projectId });
    return 0;
  }
}

const projectId = process.argv[2] || 'c994926c-9fc7-4a2b-911e-90ecaf29c605';

checkBorelogs(projectId)
  .then(count => {
    logger.info(`Total borelogs found: ${count}`);
    process.exit(0);
  })
  .catch(error => {
    logger.error('Script failed', { error });
    process.exit(1);
  });



