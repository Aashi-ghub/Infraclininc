import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from './api';
import { User, UserRole } from './types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string, role?: UserRole) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  setRole: (role: UserRole) => void;
  hasPermission: (requiredRoles: UserRole[]) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const initializeAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Development mock users for different roles
  const mockUsers = {
    Admin: {
      id: 'user-admin',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'Admin' as UserRole
    },
    Engineer: {
      id: 'user-engineer',
      email: 'engineer@example.com',
      name: 'Engineer User',
      role: 'Engineer' as UserRole
    },
    Logger: {
      id: 'user-logger',
      email: 'logger@example.com',
      name: 'Logger User',
      role: 'Logger' as UserRole
    },
    Viewer: {
      id: 'user-viewer',
      email: 'viewer@example.com',
      name: 'Viewer User',
      role: 'Viewer' as UserRole
    }
  };
  
  const mockToken = 'mock-jwt-token-for-development';

  const initialize = () => {
    // First check localStorage
    const storedToken = localStorage.getItem('auth_token');
    const storedRole = localStorage.getItem('user_role') as UserRole | null;
    
    if (storedToken) {
      setToken(storedToken);
      // Set axios default header
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      
      try {
        // For development, immediately set the user if we have a token
        // This prevents API calls that might fail in development
        if (import.meta.env.DEV) {
          const role = storedRole || 'Admin';
          setUser(mockUsers[role as keyof typeof mockUsers]);
          setIsLoading(false);
          return;
        }
        
        // For production, validate token and get user info
        apiClient.get('/auth/me')
          .then(response => {
            setUser(response.data);
          })
          .catch(() => {
            // Token invalid, clear it
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_role');
            setToken(null);
            delete apiClient.defaults.headers.common['Authorization'];
          })
          .finally(() => {
            setIsLoading(false);
          });
      } catch (error) {
        console.error('Error initializing auth:', error);
        setIsLoading(false);
      }
    } else {
      // For development, auto-login with mock credentials
      if (import.meta.env.DEV) {
        const role = storedRole || 'Admin';
        setToken(mockToken);
        setUser(mockUsers[role as keyof typeof mockUsers]);
        localStorage.setItem('auth_token', mockToken);
        localStorage.setItem('user_role', role);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${mockToken}`;
      }
      
      setIsLoading(false);
    }
  };

  // Run initialize on component mount
  useEffect(() => {
    initialize();
  }, []);

  const login = async (email: string, password: string, role: UserRole = 'Admin') => {
    try {
      // For development/demo purposes - mock login with role selection
      if (import.meta.env.DEV) {
        const mockUser = mockUsers[role];
        setToken(mockToken);
        setUser(mockUser);
        localStorage.setItem('auth_token', mockToken);
        localStorage.setItem('user_role', role);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${mockToken}`;
        return;
      }
      
      // Real API call for production
      const response = await apiClient.post('/auth/login', { email, password });
      const { token: newToken, user: userData } = response.data;
      
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('auth_token', newToken);
      localStorage.setItem('user_role', userData.role);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    delete apiClient.defaults.headers.common['Authorization'];
  };

  // Function to change user role (for development/testing)
  const setRole = (role: UserRole) => {
    if (import.meta.env.DEV) {
      const mockUser = mockUsers[role];
      setUser(mockUser);
      localStorage.setItem('user_role', role);
    }
  };

  // Function to check if current user has required permissions
  const hasPermission = (requiredRoles: UserRole[]): boolean => {
    if (!user) return false;
    return requiredRoles.includes(user.role);
  };

  return {
    user,
    token,
    login,
    logout,
    isLoading,
    setRole,
    hasPermission,
    initialize
  };
};