/**
 * Temporary Authentication Service
 * 
 * This is a TEMPORARY implementation that will be replaced with Cognito.
 * The interface is designed to make Cognito migration trivial.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole, JwtPayload } from '../utils/validateInput';
import { getSecret } from '../utils/secrets';
import { logger } from '../utils/logger';
import * as userStore from './userStore';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

export interface AuthResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
}

/**
 * Generate JWT token
 */
async function generateToken(userId: string, email: string, role: UserRole): Promise<string> {
  const JWT_SECRET = process.env.NODE_ENV === 'production' 
    ? await getSecret('JWT_SECRET')
    : 'your-fixed-development-secret-key-make-it-long-and-secure-123';

  const token = jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  logger.debug('Generated JWT token', { userId, email, role });
  return token;
}

/**
 * Hash password using bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Compare password with hash
 */
async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Login user
 * 
 * TEMPORARY: Uses JSON file for user storage
 * Migration: Replace with Cognito authentication
 */
export async function login(credentials: LoginCredentials): Promise<AuthResult> {
  const { email, password } = credentials;

  // Normalize email (trim and lowercase for comparison)
  const normalizedEmail = email.trim().toLowerCase();
  logger.debug('[AUTH] Login attempt', { email: normalizedEmail, passwordLength: password?.length });

  // Find user (TEMPORARY: from JSON file)
  const user = userStore.findUserByEmail(normalizedEmail);
  
  if (!user) {
    logger.warn('[AUTH] Login attempt with invalid email', { email: normalizedEmail });
    throw new Error('Invalid credentials');
  }
  
  logger.debug('[AUTH] User found', { userId: user.id, email: user.email });

  // TEMPORARY: Compare plain text password (for demo)
  // In production with Cognito, this would use Cognito's authentication
  // For now, we'll support both plain text (for easy demo) and hashed passwords
  let isPasswordValid = false;
  
  // Trim passwords to handle any whitespace issues
  const trimmedPassword = password.trim();
  const trimmedStoredPassword = user.password.trim();
  
  if (trimmedStoredPassword.startsWith('$2a$') || trimmedStoredPassword.startsWith('$2b$')) {
    // Password is hashed, use bcrypt
    isPasswordValid = await comparePassword(trimmedPassword, trimmedStoredPassword);
    logger.debug('[AUTH] Using bcrypt password comparison', { email });
  } else {
    // Plain text password (TEMPORARY - for demo only)
    // Case-sensitive comparison for security
    isPasswordValid = trimmedPassword === trimmedStoredPassword;
    if (isPasswordValid) {
      logger.debug('[AUTH] Using plain text password comparison (TEMPORARY)', { email });
    } else {
      logger.warn('[AUTH] Password mismatch', { 
        email, 
        passwordLength: trimmedPassword.length,
        storedPasswordLength: trimmedStoredPassword.length,
        passwordsMatch: trimmedPassword === trimmedStoredPassword
      });
    }
  }

  if (!isPasswordValid) {
    logger.warn('[AUTH] Login attempt with invalid password', { email });
    throw new Error('Invalid credentials');
  }

  // Generate token
  const token = await generateToken(user.id, user.email, user.role);

  logger.info('User logged in successfully', { userId: user.id, email, role: user.role });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  };
}

/**
 * Register new user
 * 
 * TEMPORARY: Stores in JSON file
 * Migration: Replace with Cognito user creation
 */
export async function register(data: RegisterData): Promise<AuthResult> {
  const { email, password, name, role } = data;

  // Check if user already exists
  const existingUser = userStore.findUserByEmail(email);
  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Hash password (TEMPORARY: store in JSON)
  // In production with Cognito, password would be handled by Cognito
  const hashedPassword = await hashPassword(password);

  // Create user (TEMPORARY: in JSON file)
  const user = userStore.addUser({
    email,
    password: hashedPassword, // Store hashed password
    name,
    role
  });

  // Generate token
  const token = await generateToken(user.id, user.email, user.role);

  logger.info('User registered successfully', { userId: user.id, email, role });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  };
}

/**
 * Get user by ID
 * 
 * TEMPORARY: Reads from JSON file
 * Migration: Replace with Cognito user lookup
 */
export function getUserById(userId: string) {
  const user = userStore.findUserById(userId);
  
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
}

/**
 * Verify JWT token and return payload
 * 
 * This function can remain the same when migrating to Cognito
 * as Cognito also uses JWT tokens
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const JWT_SECRET = process.env.NODE_ENV === 'production' 
      ? await getSecret('JWT_SECRET')
      : 'your-fixed-development-secret-key-make-it-long-and-secure-123';

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    logger.debug('Token verification failed', { error });
    return null;
  }
}

