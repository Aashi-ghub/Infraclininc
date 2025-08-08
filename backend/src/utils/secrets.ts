import { logger } from './logger';
import { SecretsManager } from 'aws-sdk';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface Secrets {
  JWT_SECRET: string;
  // Add other secrets here as needed
}

let cachedSecrets: Secrets | null = null;

/**
 * Generates a secure random string for use as a secret
 */
function generateSecureSecret(): string {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Gets the path to the local secrets file
 */
function getLocalSecretsPath(): string {
  return path.join(process.cwd(), '.secrets.json');
}

/**
 * Loads secrets from AWS Secrets Manager
 */
async function loadFromAWS(secretName: string): Promise<Secrets> {
  const secretsManager = new SecretsManager();
  const result = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
  
  if (!result.SecretString) {
    throw new Error('No secret string found in AWS Secrets Manager');
  }

  return JSON.parse(result.SecretString);
}

/**
 * Loads or creates local development secrets
 */
function loadLocalSecrets(): Secrets {
  const secretsPath = getLocalSecretsPath();
  
  try {
    // Try to read existing secrets
    if (fs.existsSync(secretsPath)) {
      const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
      return secrets;
    }
  } catch (error) {
    logger.warn('Failed to read local secrets, will create new ones', { error });
  }

  // Create new secrets
  const secrets: Secrets = {
    JWT_SECRET: generateSecureSecret(),
  };

  // Save new secrets
  try {
    fs.writeFileSync(secretsPath, JSON.stringify(secrets, null, 2));
    logger.info('Created new local secrets file');
  } catch (error) {
    logger.error('Failed to write local secrets file', { error });
  }

  return secrets;
}

/**
 * Gets secrets, using AWS Secrets Manager in production and local file in development
 */
export async function getSecrets(): Promise<Secrets> {
  // Return cached secrets if available
  if (cachedSecrets) {
    return cachedSecrets;
  }

  try {
    // In production, use AWS Secrets Manager
    if (process.env.NODE_ENV === 'production') {
      const secretName = process.env.SECRETS_NAME;
      if (!secretName) {
        throw new Error('SECRETS_NAME environment variable not set');
      }

      cachedSecrets = await loadFromAWS(secretName);
      logger.info('Loaded secrets from AWS Secrets Manager');
    }
    // In development, use local file
    else {
      cachedSecrets = loadLocalSecrets();
      logger.info('Loaded secrets from local file');
    }

    return cachedSecrets;
  } catch (error) {
    logger.error('Failed to load secrets', { error });
    throw error;
  }
}

/**
 * Gets a specific secret value
 */
export async function getSecret(key: keyof Secrets): Promise<string> {
  const secrets = await getSecrets();
  return secrets[key];
}

// Add this to help with testing and development
export function clearSecretsCache() {
  cachedSecrets = null;
}