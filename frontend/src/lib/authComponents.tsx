import { ReactNode, useEffect } from 'react';
import { AuthContext, useAuth, User, initializeAuth } from './auth';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = initializeAuth();
  
  return (
    <AuthContext.Provider value={{ 
      user: auth.user, 
      token: auth.token, 
      login: auth.login, 
      logout: auth.logout, 
      isLoading: auth.isLoading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const ProtectedRoute = ({ 
  children, 
  allowedRoles 
}: { 
  children: ReactNode; 
  allowedRoles?: User['role'][];
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // You should create a loading component
  }

  if (!user) {
    window.location.href = '/auth/login';
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return null; // You should create an unauthorized access component
  }

  return <>{children}</>;
}; 