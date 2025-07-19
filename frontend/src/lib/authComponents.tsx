import { ReactNode, useEffect } from 'react';
import { AuthContext, useAuth, initializeAuth } from './auth';
import { UserRole } from './types';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = initializeAuth();
  
  return (
    <AuthContext.Provider value={{ 
      user: auth.user, 
      token: auth.token, 
      login: auth.login, 
      logout: auth.logout, 
      isLoading: auth.isLoading,
      setRole: auth.setRole,
      hasPermission: auth.hasPermission
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
  allowedRoles?: UserRole[];
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // You should create a loading component
  }

  if (!user) {
    // Use the correct path that exists in the router
    window.location.href = '/';
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <UnauthorizedAccess />; // Show unauthorized access component
  }

  return <>{children}</>;
};

// Component for unauthorized access
export const UnauthorizedAccess = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8 max-w-md">
        <h2 className="text-2xl font-bold text-destructive mb-4">Access Denied</h2>
        <p className="text-muted-foreground mb-6">
          You don't have permission to access this resource. Please contact your administrator if you believe this is an error.
        </p>
        <a href="/" className="inline-block px-4 py-2 bg-primary text-white rounded hover:bg-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

// Component for conditional rendering based on role
export const RoleGuard = ({ 
  children, 
  allowedRoles 
}: { 
  children: ReactNode; 
  allowedRoles: UserRole[];
}) => {
  const { hasPermission } = useAuth();
  
  return hasPermission(allowedRoles) ? <>{children}</> : null;
}; 