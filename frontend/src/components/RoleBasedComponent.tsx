import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { UserRole } from '@/lib/types';

interface RoleBasedComponentProps {
  allowedRoles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * A component that conditionally renders content based on user roles
 * @param allowedRoles - Array of roles that are allowed to see the content
 * @param children - Content to show if user has permission
 * @param fallback - Optional content to show if user doesn't have permission
 */
export function RoleBasedComponent({ allowedRoles, children, fallback = null }: RoleBasedComponentProps) {
  const { user } = useAuth();
  
  // If no user or role doesn't match, show fallback
  if (!user || !allowedRoles.includes(user.role)) {
    return <>{fallback}</>;
  }
  
  // User has permission, show content
  return <>{children}</>;
}

/**
 * Button that only shows for specific roles
 */
export function AdminOnlyButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <RoleBasedComponent allowedRoles={['Admin']}>
      <button {...props} />
    </RoleBasedComponent>
  );
}

/**
 * Button that shows for Admin and Engineer roles
 */
export function AdminEngineerButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <RoleBasedComponent allowedRoles={['Admin', 'Engineer']}>
      <button {...props} />
    </RoleBasedComponent>
  );
}

/**
 * Component that shows current user role
 */
export function UserRoleBadge() {
  const { user } = useAuth();
  
  if (!user) return null;
  
  const roleColors = {
    Admin: 'bg-red-100 text-red-800 border-red-200',
    Engineer: 'bg-blue-100 text-blue-800 border-blue-200',
    Logger: 'bg-green-100 text-green-800 border-green-200',
    Viewer: 'bg-gray-100 text-gray-800 border-gray-200'
  };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${roleColors[user.role]}`}>
      {user.role}
    </span>
  );
} 