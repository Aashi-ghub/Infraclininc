import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { User, UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { RoleBasedComponent } from '@/components/RoleBasedComponent';
import { Loader } from '@/components/Loader';

interface Project {
  project_id: string;
  name: string;
  location?: string;
  created_at: string;
}

interface UserWithId extends User {
  user_id: string;
}

interface AssignmentFormData {
  project_id: string;
  assignment_type: 'AdminToManager' | 'ManagerToTeam';
  assigner: string[];
  assignee: string[];
}

export default function ProjectAssignmentPage() {
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedAssigners, setSelectedAssigners] = useState<string[]>([]);

  const [formData, setFormData] = useState<AssignmentFormData>({
    project_id: '',
    assignment_type: 'AdminToManager',
    assigner: [],
    assignee: []
  });

  // Check if user has admin permissions
  if (!hasPermission(['Admin'])) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
              <p className="text-gray-600">You don't have permission to access this page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [projectsResponse, usersResponse] = await Promise.all([
        apiClient.get('/projects'),
        apiClient.get('/users')
      ]);
      setProjects(projectsResponse.data.data);
      setUsers(usersResponse.data.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch projects or users',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssignmentTypeChange = (value: 'AdminToManager' | 'ManagerToTeam') => {
    setFormData({ ...formData, assignment_type: value });
    // Reset selections when assignment type changes
    setSelectedUsers([]);
    setSelectedAssigners([]);
  };

  const handleUserSelection = (userId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedUsers([...selectedUsers, userId]);
    } else {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    }
  };

  const handleAssignerSelection = (userId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedAssigners([...selectedAssigners, userId]);
    } else {
      setSelectedAssigners(selectedAssigners.filter(id => id !== userId));
    }
  };

  const handleSubmit = async () => {
    if (!formData.project_id) {
      toast({
        title: 'Error',
        description: 'Please select a project',
        variant: 'destructive'
      });
      return;
    }

    if (selectedAssigners.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one assigner',
        variant: 'destructive'
      });
      return;
    }

    if (selectedUsers.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one assignee',
        variant: 'destructive'
      });
      return;
    }

    try {
      const assignmentData = {
        ...formData,
        assigner: selectedAssigners,
        assignee: selectedUsers
      };

      await apiClient.post('/assignments', assignmentData);
      toast({
        title: 'Success',
        description: 'Users assigned to project successfully'
      });

      // Reset form
      setFormData({
        project_id: '',
        assignment_type: 'AdminToManager',
        assigner: [],
        assignee: []
      });
      setSelectedUsers([]);
      setSelectedAssigners([]);
    } catch (error: any) {
      console.error('Error creating assignment:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create assignment',
        variant: 'destructive'
      });
    }
  };

  const getUsersByRole = (role: UserRole) => {
    return users.filter(user => user.role === role);
  };

  const roleColors = {
    'Admin': 'bg-red-100 text-red-800 border-red-200',
    'Project Manager': 'bg-blue-100 text-blue-800 border-blue-200',
    'Site Engineer': 'bg-green-100 text-green-800 border-green-200',
    'Approval Engineer': 'bg-purple-100 text-purple-800 border-purple-200',
    'Lab Engineer': 'bg-amber-100 text-amber-800 border-amber-200',
    'Customer': 'bg-gray-100 text-gray-800 border-gray-200'
  };

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Project Assignment</h1>
        <p className="text-gray-600 mt-2">Assign users to projects with specific roles</p>
      </div>

      <div className="grid gap-6">
        {/* Project Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Project Selection</CardTitle>
            <CardDescription>Select the project to assign users to</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="project">Project</Label>
                <Select value={formData.project_id} onValueChange={(value) => setFormData({ ...formData, project_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.project_id} value={project.project_id}>
                        {project.name} {project.location && `(${project.location})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="assignment-type">Assignment Type</Label>
                <Select value={formData.assignment_type} onValueChange={handleAssignmentTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AdminToManager">Admin to Manager</SelectItem>
                    <SelectItem value="ManagerToTeam">Manager to Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assigner Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Assigners</CardTitle>
            <CardDescription>
              {formData.assignment_type === 'AdminToManager' 
                ? 'Select admin users who will assign project managers'
                : 'Select project managers who will assign team members'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {formData.assignment_type === 'AdminToManager' ? (
                // Show Admin users for AdminToManager assignment
                getUsersByRole('Admin').map((user) => (
                  <div key={user.user_id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`assigner-${user.user_id}`}
                      checked={selectedAssigners.includes(user.user_id)}
                      onCheckedChange={(checked) => handleAssignerSelection(user.user_id, checked as boolean)}
                    />
                    <Label htmlFor={`assigner-${user.user_id}`} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{user.name}</span>
                        <span className="text-sm text-gray-500">{user.email}</span>
                      </div>
                    </Label>
                  </div>
                ))
              ) : (
                // Show Project Manager users for ManagerToTeam assignment
                getUsersByRole('Project Manager').map((user) => (
                  <div key={user.user_id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`assigner-${user.user_id}`}
                      checked={selectedAssigners.includes(user.user_id)}
                      onCheckedChange={(checked) => handleAssignerSelection(user.user_id, checked as boolean)}
                    />
                    <Label htmlFor={`assigner-${user.user_id}`} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{user.name}</span>
                        <span className="text-sm text-gray-500">{user.email}</span>
                      </div>
                    </Label>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Assignee Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Assignees</CardTitle>
            <CardDescription>
              {formData.assignment_type === 'AdminToManager' 
                ? 'Select project managers to assign to the project'
                : 'Select team members to assign to the project'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {formData.assignment_type === 'AdminToManager' ? (
                // Show Project Manager users for AdminToManager assignment
                getUsersByRole('Project Manager').map((user) => (
                  <div key={user.user_id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`assignee-${user.user_id}`}
                      checked={selectedUsers.includes(user.user_id)}
                      onCheckedChange={(checked) => handleUserSelection(user.user_id, checked as boolean)}
                    />
                    <Label htmlFor={`assignee-${user.user_id}`} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{user.name}</span>
                        <span className="text-sm text-gray-500">{user.email}</span>
                      </div>
                    </Label>
                  </div>
                ))
              ) : (
                // Show other roles for ManagerToTeam assignment
                users.filter(user => user.role !== 'Admin' && user.role !== 'Project Manager').map((user) => (
                  <div key={user.user_id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`assignee-${user.user_id}`}
                      checked={selectedUsers.includes(user.user_id)}
                      onCheckedChange={(checked) => handleUserSelection(user.user_id, checked as boolean)}
                    />
                    <Label htmlFor={`assignee-${user.user_id}`} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.name}</span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${roleColors[user.role] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                            {user.role}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">{user.email}</span>
                      </div>
                    </Label>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={!formData.project_id || selectedAssigners.length === 0 || selectedUsers.length === 0}>
            Create Assignment
          </Button>
        </div>
      </div>
    </div>
  );
} 