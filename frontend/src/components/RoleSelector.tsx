import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { UserRole } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { UserRoleBadge } from './RoleBasedComponent';

/**
 * A component that allows switching between user roles for development/testing
 * Only appears in development mode
 */
export function RoleSelector() {
  const { user, setRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  
  // Only show in development mode
  if (!import.meta.env.DEV) {
    return null;
  }
  
  if (!user) {
    return null;
  }
  
  const handleRoleChange = (role: string) => {
    setRole(role as UserRole);
  };
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <div className="bg-background border rounded-lg shadow-lg p-4 w-64">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Switch Role (Dev Only)</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
          </div>
          
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">Current:</span>
            <UserRoleBadge />
          </div>
          
          <Select 
            defaultValue={user.role} 
            onValueChange={handleRoleChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Admin">Admin</SelectItem>
              <SelectItem value="Engineer">Engineer</SelectItem>
              <SelectItem value="Logger">Logger</SelectItem>
              <SelectItem value="Viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setIsOpen(true)}
          className="bg-background shadow-md"
        >
          <UserRoleBadge />
        </Button>
      )}
    </div>
  );
} 