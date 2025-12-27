import { logger } from '../utils/logger';
import { createStorageClient } from '../storage/s3Client';

export interface SubstructureAssignment {
  assignment_id: string;
  borelog_id: string;
  substructure_id: string;
  created_at: string;
  updated_at: string;
}

export async function getSubstructureAssignment(borelog_id: string): Promise<SubstructureAssignment | null> {
  try {
    const meta = await findBorelogMetadata(borelog_id);
    if (!meta) return null;

    return {
      assignment_id: meta.borelog_id,
      borelog_id: meta.borelog_id,
      substructure_id: meta.substructure_id,
      created_at: meta.created_at || new Date().toISOString(),
      updated_at: meta.updated_at || new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error getting substructure assignment', { error, borelog_id });
    throw error;
  }
}

export async function createOrUpdateSubstructureAssignment(
  borelog_id: string,
  substructure_id: string | null
): Promise<SubstructureAssignment | null> {
  try {
    const storage = createStorageClient();
    const metaInfo = await findBorelogMetadata(borelog_id, storage);
    if (!metaInfo) {
      logger.warn('Borelog metadata not found for substructure update', { borelog_id });
      return null;
    }

    const { key, metadata } = metaInfo;

    if (substructure_id === null) {
      // Remove assignment by clearing substructure_id
      delete metadata.substructure_id;
    } else {
      metadata.substructure_id = substructure_id;
    }
    metadata.updated_at = new Date().toISOString();

    await storage.uploadFile(
      key,
      Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8'),
      'application/json'
    );

    return {
      assignment_id: metadata.borelog_id || borelog_id,
      borelog_id,
      substructure_id: metadata.substructure_id || null,
      created_at: metadata.created_at || metadata.updated_at,
      updated_at: metadata.updated_at,
    } as SubstructureAssignment;
  } catch (error) {
    logger.error('Error creating or updating substructure assignment', { error, borelog_id, substructure_id });
    throw error;
  }
}

export async function getAllSubstructureAssignments(): Promise<SubstructureAssignment[]> {
  try {
    const storage = createStorageClient();
    const metas = await listAllBorelogMetadata(storage);
    return metas.map(meta => ({
      assignment_id: meta.borelog_id,
      borelog_id: meta.borelog_id,
      substructure_id: meta.substructure_id,
      created_at: meta.created_at || new Date().toISOString(),
      updated_at: meta.updated_at || new Date().toISOString(),
    }));
  } catch (error) {
    logger.error('Error getting all substructure assignments', { error });
    throw error;
  }
} 

async function listAllBorelogMetadata(storage = createStorageClient()) {
  const allKeys = await storage.listFiles('projects/', 50000);
  const metaKeys = allKeys.filter(k =>
    k.endsWith('/metadata.json') &&
    k.includes('/borelogs/') &&
    !k.includes('/versions/')
  );

  const metas: any[] = [];
  for (const key of metaKeys) {
    try {
      const buf = await storage.downloadFile(key);
      const meta = JSON.parse(buf.toString('utf-8'));
      metas.push({ ...meta, __key: key });
    } catch (err) {
      logger.warn('Failed to parse borelog metadata during listing', { key, err });
    }
  }
  return metas;
}

async function findBorelogMetadata(borelogId: string, storage = createStorageClient()) {
  const metas = await listAllBorelogMetadata(storage);
  const match = metas.find(m => m.borelog_id === borelogId);
  if (!match) return null;
  return { metadata: match, key: match.__key };
}