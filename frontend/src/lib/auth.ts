import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from './api';
import { User, UserRole } from './types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  hasPermission: (requiredRoles: UserRole[]) => boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: async () => {},
  logout: () => {},
  isLoading: true,
  hasPermission: () => false,
});

export const useAuth = () => useContext(AuthContext);

export const initializeAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    try {
      // First check localStorage
      const storedToken = localStorage.getItem('auth_token');
      const storedEmail = localStorage.getItem('user_email');
      
      if (storedToken) {
        setToken(storedToken);
        // Set axios default header
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        
        try {
          // Try to validate token with backend
          const response = await apiClient.get('/auth/me');
          setUser(response.data.data);
        } catch (error) {
          console.warn('Token validation failed');
          
          // Token invalid, clear it
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_email');
          setToken(null);
          setUser(null);
          delete apiClient.defaults.headers.common['Authorization'];
        }
      } else {
        // No token found, user is not logged in
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Error during auth initialization:', error);
      // Ensure user is null if there's an error
      setToken(null);
      setUser(null);
    } finally {
      // Always set isLoading to false when done
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { token: newToken, user: userData } = response.data.data;
      
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('auth_token', newToken);
      localStorage.setItem('user_email', userData.email);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    // Clear auth state
    setToken(null);
    setUser(null);
    
    // Clear local storage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_email');
    
    // Clear API headers
    delete apiClient.defaults.headers.common['Authorization'];
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
    hasPermission,
    initialize
  } as const;
};