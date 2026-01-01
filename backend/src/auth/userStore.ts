/**
 * Temporary User Store
 * 
 * MIGRATED: Now uses S3 instead of local file system
 * S3 Structure: users/users.json (array of user objects)
 * 
 * This is a TEMPORARY implementation using S3 JSON file.
 * Designed to be easily replaced with Cognito when ready.
 * 
 * Migration path: Replace this module with CognitoUserStore that implements the same interface.
 */

import { logger } from '../utils/logger';
import { UserRole } from '../utils/validateInput';
import { createStorageClient } from '../storage/s3Client';

export interface User {
  id: string;
  email: string;
  password: string; // Hashed password (TEMPORARY - will use Cognito)
  role: UserRole;
  name: string;
  createdAt?: string;
  // Additional fields for compatibility
  user_id?: string;
  organisation_id?: string;
  customer_id?: string;
}

let usersCache: User[] | null = null;
const USERS_S3_KEY = 'users/users.json';

/**
 * Get S3 storage client
 */
function getStorageClient() {
  return createStorageClient();
}

/**
 * Get default users (used for initialization)
 */
function getDefaultUsers(): User[] {
  return [
    {
      id: 'u_admin',
      user_id: 'u_admin',
      email: 'admin@backendbore.com',
      password: 'admin123', // Plain text (TEMPORARY - authService supports both)
      role: 'Admin',
      name: 'Admin User',
      createdAt: new Date().toISOString()
    },
    {
      id: 'u_pm',
      user_id: 'u_pm',
      email: 'pm@backendbore.com',
      password: 'pm123',
      role: 'Project Manager',
      name: 'Project Manager',
      createdAt: new Date().toISOString()
    },
    {
      id: 'u_site',
      user_id: 'u_site',
      email: 'site@backendbore.com',
      password: 'site123',
      role: 'Site Engineer',
      name: 'Site Engineer',
      createdAt: new Date().toISOString()
    },
    {
      id: 'u_approval',
      user_id: 'u_approval',
      email: 'approval@backendbore.com',
      password: 'approval123',
      role: 'Approval Engineer',
      name: 'Approval Engineer',
      createdAt: new Date().toISOString()
    },
    {
      id: 'u_lab',
      user_id: 'u_lab',
      email: 'lab@backendbore.com',
      password: 'lab123',
      role: 'Lab Engineer',
      name: 'Lab Engineer',
      createdAt: new Date().toISOString()
    },
    {
      id: 'u_customer',
      user_id: 'u_customer',
      email: 'customer@backendbore.com',
      password: 'customer123',
      role: 'Customer',
      name: 'Customer User',
      createdAt: new Date().toISOString()
    }
  ];
}

/**
 * Ensure default users exist in the users array
 * Adds missing default users if they don't exist
 */
async function ensureDefaultUsers(users: User[]): Promise<User[]> {
  const defaultUsers = getDefaultUsers();
  const defaultEmails = defaultUsers.map(u => u.email.toLowerCase());
  const existingEmails = users.map(u => u.email.toLowerCase());
  
  let updated = false;
  const updatedUsers = [...users];
  
  // Add any missing default users
  for (const defaultUser of defaultUsers) {
    if (!existingEmails.includes(defaultUser.email.toLowerCase())) {
      updatedUsers.push(defaultUser);
      updated = true;
      logger.info(`Adding missing default user: ${defaultUser.email}`);
    }
  }
  
  // If we added users, save to S3
  if (updated) {
    try {
      await saveUsersToS3(updatedUsers);
      logger.info('Updated users file with missing default users');
    } catch (error) {
      logger.error('Failed to save updated users to S3:', error);
    }
  }
  
  return updatedUsers;
}

/**
 * Load users from S3
 * Cached after first load for performance
 */
export async function loadUsers(): Promise<User[]> {
  if (usersCache !== null) {
    // Quick check: if admin user is missing, force reload to ensure defaults
    const hasAdmin = usersCache.some(u => 
      u.email.toLowerCase() === 'admin@backendbore.com' || 
      u.id === 'u_admin' || 
      u.user_id === 'u_admin'
    );
    if (!hasAdmin) {
      logger.warn('Admin user missing from cache, forcing reload to ensure defaults');
      usersCache = null; // Force reload
    } else {
      return usersCache;
    }
  }

  try {
    const storageClient = getStorageClient();
    const buf = await storageClient.downloadFile(USERS_S3_KEY);
    const users = JSON.parse(buf.toString('utf-8')) as User[];
    
    // Normalize user IDs (support both 'id' and 'user_id')
    const normalizedUsers = users.map(user => ({
      ...user,
      id: user.id || user.user_id || '',
      user_id: user.user_id || user.id || ''
    }));
    
    // Ensure default users exist
    const usersWithDefaults = await ensureDefaultUsers(normalizedUsers);
    
    // Update cache with users that include defaults
    usersCache = usersWithDefaults;
    logger.info(`Loaded ${usersCache.length} users from S3 (including defaults)`);
    return usersCache;
  } catch (error: any) {
    // If file doesn't exist, create default users
    if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
      logger.warn('Users file not found in S3, initializing with default users');
      const defaultUsers = getDefaultUsers();
      
      // Save default users to S3
      try {
        await saveUsersToS3(defaultUsers);
        usersCache = defaultUsers;
        logger.info('Created default users in S3');
        return usersCache;
      } catch (saveError) {
        logger.error('Failed to save default users to S3:', saveError);
        // Return default users anyway (in-memory only)
        usersCache = defaultUsers;
        return usersCache;
      }
    }
    
    logger.error('Failed to load users from S3:', error);
    // Return default users as fallback
    const defaultUsers = getDefaultUsers();
    usersCache = defaultUsers;
    return usersCache;
  }
}

/**
 * Save users to S3
 */
async function saveUsersToS3(users: User[]): Promise<void> {
  try {
    const storageClient = getStorageClient();
    const jsonContent = JSON.stringify(users, null, 2);
    await storageClient.uploadFile(USERS_S3_KEY, Buffer.from(jsonContent, 'utf-8'), 'application/json');
    logger.info(`Saved ${users.length} users to S3`);
  } catch (error) {
    logger.error('Failed to save users to S3:', error);
    throw new Error('Failed to save users to S3');
  }
}

/**
 * Find user by email
 */
export async function findUserByEmail(email: string): Promise<User | undefined> {
  const users = await loadUsers();
  // Case-insensitive email comparison for compatibility
  const normalizedEmail = email.trim().toLowerCase();
  const user = users.find(u => u.email.trim().toLowerCase() === normalizedEmail);
  
  if (!user) {
    logger.debug(`[AUTH] User not found for email: ${email} (normalized: ${normalizedEmail})`);
  } else {
    logger.debug(`[AUTH] User found: ${user.id} (${user.email})`);
  }
  
  return user;
}

/**
 * Find user by ID
 */
export async function findUserById(id: string): Promise<User | undefined> {
  const users = await loadUsers();
  return users.find(u => u.id === id || u.user_id === id);
}

/**
 * Add a new user (TEMPORARY - for demo/admin use only)
 * In production with Cognito, this would create a Cognito user instead
 */
export async function addUser(user: Omit<User, 'id' | 'createdAt'>): Promise<User> {
  const users = await loadUsers();
  
  // Check if user already exists
  const existing = await findUserByEmail(user.email);
  if (existing) {
    throw new Error('User with this email already exists');
  }

  // Generate ID
  const newUser: User = {
    ...user,
    id: `u_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    user_id: `u_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString()
  };

  // Add to cache
  users.push(newUser);
  usersCache = users;

  // Write to S3
  try {
    await saveUsersToS3(users);
    logger.info(`Added new user: ${user.email}`);
  } catch (error) {
    logger.error('Failed to save user to S3:', error);
    // Rollback cache
    usersCache = users.filter(u => u.id !== newUser.id);
    throw new Error('Failed to save user');
  }

  return newUser;
}

/**
 * Clear the users cache (useful for testing or reloading)
 */
export function clearUsersCache(): void {
  usersCache = null;
  logger.info('Users cache cleared');
}

/**
 * Force reload users from S3 (clears cache and reloads)
 */
export async function reloadUsers(): Promise<User[]> {
  clearUsersCache();
  return await loadUsers();
}

/**
 * Get all users (for admin purposes)
 */
export async function getAllUsers(): Promise<User[]> {
  return await loadUsers();
}
