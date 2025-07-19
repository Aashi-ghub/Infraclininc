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

  // Development mock users for different roles
  const mockUsers = {
    'admin@example.com': {
      id: 'user-admin',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'Admin' as UserRole
    },
    'pm@example.com': {
      id: 'user-pm',
      email: 'pm@example.com',
      name: 'Project Manager',
      role: 'Project Manager' as UserRole
    },
    'site@example.com': {
      id: 'user-site',
      email: 'site@example.com',
      name: 'Site Engineer',
      role: 'Site Engineer' as UserRole
    },
    'approval@example.com': {
      id: 'user-approval',
      email: 'approval@example.com',
      name: 'Approval Engineer',
      role: 'Approval Engineer' as UserRole
    },
    'lab@example.com': {
      id: 'user-lab',
      email: 'lab@example.com',
      name: 'Lab Engineer',
      role: 'Lab Engineer' as UserRole
    },
    'customer@example.com': {
      id: 'user-customer',
      email: 'customer@example.com',
      name: 'Customer User',
      role: 'Customer' as UserRole
    }
  };
  
  const mockToken = 'mock-jwt-token-for-development';

  const initialize = () => {
    // First check localStorage
    const storedToken = localStorage.getItem('auth_token');
    const storedEmail = localStorage.getItem('user_email');
    
    if (storedToken) {
      setToken(storedToken);
      // Set axios default header
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      
      try {
        // For development, immediately set the user if we have a token
        // This prevents API calls that might fail in development
        if (import.meta.env.DEV && storedEmail && mockUsers[storedEmail as keyof typeof mockUsers]) {
          setUser(mockUsers[storedEmail as keyof typeof mockUsers]);
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
            localStorage.removeItem('user_email');
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
      // No token found, user is not logged in
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
      if (import.meta.env.DEV) {
        // Check if the email exists in our mock users
        const mockUser = mockUsers[email as keyof typeof mockUsers];
        
        if (!mockUser) {
          throw new Error('Invalid credentials');
        }
        
        // In a real app, you would validate the password here
        if (password !== 'password123') {
          throw new Error('Invalid credentials');
        }
        
        setToken(mockToken);
        setUser(mockUser);
        localStorage.setItem('auth_token', mockToken);
        localStorage.setItem('user_email', email);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${mockToken}`;
        return;
      }
      
      // Real API call for production
      const response = await apiClient.post('/auth/login', { email, password });
      const { token: newToken, user: userData } = response.data;
      
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('auth_token', newToken);
      localStorage.setItem('user_email', userData.email);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } catch (error) {
      console.error('Login failed:', error);
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
    
    // The actual navigation will be handled by the component that calls this function
    // This makes the auth service more decoupled from routing
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
  };
};