import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { borelogAssignmentApi, userApi, projectApi, structureApi } from '@/lib/api';
import { BorelogAssignment, User, Project, Structure } from '@/lib/types';
import { format } from 'date-fns';
import { useAuth } from '@/lib/auth';
import { RoleBasedComponent } from '@/components/RoleBasedComponent';

export default function BorelogAssignmentsPage() {
  const [assignments, setAssignments] = useState<BorelogAssignment[]>([]);
  const [siteEngineers, setSiteEngineers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedStructure, setSelectedStructure] = useState<string>('');
  const [selectedSiteEngineer, setSelectedSiteEngineer] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadStructures(selectedProject);
    } else {
      setStructures([]);
    }
  }, [selectedProject]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [assignmentsRes, siteEngineersRes, projectsRes] = await Promise.all([
        borelogAssignmentApi.getActive(),
        userApi.list(),
        projectApi.list()
      ]);

      setAssignments(assignmentsRes.data.data || []);
      const engineers = siteEngineersRes.data.data.filter((user: User) => user.role === 'Site Engineer');
      setSiteEngineers(engineers);
      setProjects(projectsRes.data.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load assignments data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadStructures = async (projectId: string) => {
    try {
      const response = await structureApi.getByProject(projectId);
      setStructures(response.data.data || []);
    } catch (error) {
      console.error('Failed to load structures:', error);
      toast({
        title: 'Error',
        description: 'Failed to load structures.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'completed':
        return 'success';
      default:
        return 'outline';
    }
  };

  const getAssignmentTarget = (assignment: BorelogAssignment) => {
    if (assignment.borelog_id) return 'Borelog';
    if (assignment.structure_id) return 'Structure';
    if (assignment.substructure_id) return 'Substructure';
    return 'Unknown';
  };

  const filteredAssignments = assignments.filter(assignment => {
    const matchesStatus = statusFilter === 'all' || assignment.status === statusFilter;
    const matchesSiteEngineer = !selectedSiteEngineer || assignment.assigned_site_engineer === selectedSiteEngineer;
    const matchesProject = !selectedProject || assignment.project_name === projects.find(p => p.project_id === selectedProject)?.name;
    
    return matchesStatus && matchesSiteEngineer && matchesProject;
  });

  const handleRefresh = () => {
    loadData();
  };

  if (!user || (user.role !== 'Admin' && user.role !== 'Project Manager')) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You don't have permission to view this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Borelog Assignments</h1>
          <p className="text-muted-foreground">
            Manage site engineer assignments for borelogs, structures, and substructures
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter assignments by various criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium">Site Engineer</label>
              <Select value={selectedSiteEngineer} onValueChange={setSelectedSiteEngineer}>
                <SelectTrigger>
                  <SelectValue placeholder="All Engineers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Engineers</SelectItem>
                  {siteEngineers.map((engineer) => (
                    <SelectItem key={engineer.user_id} value={engineer.user_id}>
                      {engineer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Project</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.project_id} value={project.project_id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Structure</label>
              <Select value={selectedStructure} onValueChange={setSelectedStructure}>
                <SelectTrigger>
                  <SelectValue placeholder="All Structures" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Structures</SelectItem>
                  {structures.map((structure) => (
                    <SelectItem key={structure.structure_id} value={structure.structure_id}>
                      {structure.type} - {structure.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assignments List */}
      <Card>
        <CardHeader>
          <CardTitle>Assignments ({filteredAssignments.length})</CardTitle>
          <CardDescription>
            View all site engineer assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading assignments...</p>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No assignments found matching the current filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAssignments.map((assignment) => (
                <div key={assignment.assignment_id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">
                          {assignment.assigned_site_engineer_name || 'Unknown Engineer'}
                        </h3>
                        <Badge variant={getStatusBadgeVariant(assignment.status)}>
                          {assignment.status}
                        </Badge>
                        <Badge variant="outline">
                          {getAssignmentTarget(assignment)}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Engineer:</span>
                          <p className="text-muted-foreground">
                            {assignment.assigned_site_engineer_email}
                          </p>
                        </div>
                        
                        <div>
                          <span className="font-medium">Project:</span>
                          <p className="text-muted-foreground">
                            {assignment.project_name || 'Unknown'}
                          </p>
                        </div>
                        
                        <div>
                          <span className="font-medium">Structure:</span>
                          <p className="text-muted-foreground">
                            {assignment.structure_type || 'N/A'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-2">
                        <div>
                          <span className="font-medium">Assigned:</span>
                          <p className="text-muted-foreground">
                            {format(new Date(assignment.assigned_at), 'MMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                        
                        {assignment.expected_completion_date && (
                          <div>
                            <span className="font-medium">Expected Completion:</span>
                            <p className="text-muted-foreground">
                              {format(new Date(assignment.expected_completion_date), 'MMM dd, yyyy')}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {assignment.notes && (
                        <div className="mt-2">
                          <span className="font-medium text-sm">Notes:</span>
                          <p className="text-sm text-muted-foreground mt-1">{assignment.notes}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Navigate to the specific assignment management page
                          if (assignment.borelog_id) {
                            window.location.href = `/borelog/${assignment.borelog_id}`;
                          } else if (assignment.structure_id) {
                            window.location.href = `/structures/${assignment.structure_id}`;
                          }
                        }}
                      >
                        Manage
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
