/**
 * Temporary User Store
 * 
 * This is a TEMPORARY implementation using a static JSON file.
 * Designed to be easily replaced with Cognito when ready.
 * 
 * Migration path: Replace this module with CognitoUserStore that implements the same interface.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { UserRole } from '../utils/validateInput';

export interface User {
  id: string;
  email: string;
  password: string; // Plain text for now (TEMPORARY - will use Cognito)
  role: UserRole;
  name: string;
  createdAt?: string;
}

let usersCache: User[] | null = null;

/**
 * Get the path to the users.json file
 */
function getUsersFilePath(): string {
  return path.join(process.cwd(), 'auth', 'users.json');
}

/**
 * Load users from JSON file
 * Cached after first load for performance
 */
export function loadUsers(): User[] {
  if (usersCache !== null) {
    return usersCache;
  }

  try {
    const usersPath = getUsersFilePath();
    
    if (!fs.existsSync(usersPath)) {
      logger.warn(`Users file not found at ${usersPath}, creating default file`);
      // Create default users file
      const defaultUsers: User[] = [
        {
          id: 'u_admin',
          email: 'admin@backendbore.com',
          password: 'admin123',
          role: 'Admin',
          name: 'Admin User'
        }
      ];
      fs.mkdirSync(path.dirname(usersPath), { recursive: true });
      fs.writeFileSync(usersPath, JSON.stringify(defaultUsers, null, 2));
      usersCache = defaultUsers;
      logger.info('Created default users.json file');
      return usersCache;
    }

    const fileContent = fs.readFileSync(usersPath, 'utf-8');
    usersCache = JSON.parse(fileContent) as User[];
    logger.info(`Loaded ${usersCache.length} users from ${usersPath}`);
    return usersCache;
  } catch (error) {
    logger.error('Failed to load users from JSON file:', error);
    throw new Error('Failed to load user data');
  }
}

/**
 * Find user by email
 */
export function findUserByEmail(email: string): User | undefined {
  const users = loadUsers();
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
export function findUserById(id: string): User | undefined {
  const users = loadUsers();
  return users.find(u => u.id === id);
}

/**
 * Add a new user (TEMPORARY - for demo/admin use only)
 * In production with Cognito, this would create a Cognito user instead
 */
export function addUser(user: Omit<User, 'id' | 'createdAt'>): User {
  const users = loadUsers();
  
  // Check if user already exists
  if (findUserByEmail(user.email)) {
    throw new Error('User with this email already exists');
  }

  // Generate ID
  const newUser: User = {
    ...user,
    id: `u_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString()
  };

  // Add to cache
  users.push(newUser);
  usersCache = users;

  // Write to file (TEMPORARY - in production this would call Cognito)
  try {
    const usersPath = getUsersFilePath();
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    logger.info(`Added new user: ${user.email}`);
  } catch (error) {
    logger.error('Failed to save user to file:', error);
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
}

/**
 * Get all users (for admin purposes)
 */
export function getAllUsers(): User[] {
  return loadUsers();
}

