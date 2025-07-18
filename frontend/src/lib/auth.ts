import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from './api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'Admin' | 'Project Manager' | 'Reviewer' | 'Technician';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
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

  // Development mock user
  const mockUser = {
    id: 'user-1',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'Admin' as const
  };
  const mockToken = 'mock-jwt-token-for-development';

  const initialize = () => {
    // First check localStorage
    const storedToken = localStorage.getItem('auth_token');
    
    if (storedToken) {
      setToken(storedToken);
      // Set axios default header
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      
      try {
        // For development, immediately set the user if we have a token
        // This prevents API calls that might fail in development
        if (import.meta.env.DEV) {
          setUser(mockUser);
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
        setToken(mockToken);
        setUser(mockUser);
        localStorage.setItem('auth_token', mockToken);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${mockToken}`;
      }
      
      setIsLoading(false);
    }
  };

  // Run initialize on component mount
  useEffect(() => {
    initialize();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      // For development/demo purposes - mock login
      if (email === 'admin@example.com' && password === 'password123') {
        setToken(mockToken);
        setUser(mockUser);
        localStorage.setItem('auth_token', mockToken);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${mockToken}`;
        return;
      }
      
      // Real API call for production
      const response = await apiClient.post('/auth/login', { email, password });
      const { token: newToken, user: userData } = response.data;
      
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('auth_token', newToken);
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
    delete apiClient.defaults.headers.common['Authorization'];
  };

  return {
    user,
    token,
    login,
    logout,
    isLoading,
    initialize
  };
};