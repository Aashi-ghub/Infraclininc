import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Building2, MapPin, Calendar, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { projectApi } from '@/lib/api';
import { Project } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/Loader';
import { RoleBasedComponent } from '@/components/RoleBasedComponent';
import { AssignProjectManager } from '@/components/AssignProjectManager';

export default function ProjectListPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const response = await projectApi.list();
      
      if (response.data && Array.isArray(response.data.data)) {
        setProjects(response.data.data);
      } else if (response.data && Array.isArray(response.data)) {
        setProjects(response.data);
      } else {
        console.error('Unexpected projects response format:', response);
        setProjects([]);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast({
        title: 'Error',
        description: 'Failed to load projects. Please try again.',
        variant: 'destructive',
      });
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [toast]);

  // Apply search filter
  useEffect(() => {
    let filtered = projects;

    if (searchTerm.trim()) {
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (project.location && project.location.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredProjects(filtered);
  }, [projects, searchTerm]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              Projects
            </h1>
            <p className="text-muted-foreground">
              Manage your infrastructure projects and assignments
            </p>
          </div>
          
          <RoleBasedComponent allowedRoles={['Admin']}>
            <Button className="bg-gradient-to-r from-primary to-primary-glow hover:shadow-elegant transition-all duration-300" asChild>
              <Link to="/projects/create">
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Link>
            </Button>
          </RoleBasedComponent>
        </div>

        {/* Search */}
        <Card className="shadow-form mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Input
                placeholder="Search projects by name or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Showing {filteredProjects.length} of {projects.length} projects
            {searchTerm.trim() && ' (filtered)'}
          </p>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <Card className="shadow-form">
            <CardContent className="pt-6 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm.trim() 
                  ? 'No projects match your search criteria.'
                  : 'No projects have been created yet.'
                }
              </p>
              <RoleBasedComponent allowedRoles={['Admin']}>
                <Button asChild>
                  <Link to="/projects/create">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Project
                  </Link>
                </Button>
              </RoleBasedComponent>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <Card key={project.project_id} className="shadow-form hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {project.location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{project.location}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Created {formatDate(project.created_at)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>Team assigned</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <Link to={`/projects/${project.project_id}/structures`}>
                        Open
                      </Link>
                    </Button>
                    
                    <RoleBasedComponent allowedRoles={['Admin']}>
                      <AssignProjectManager
                        projectId={project.project_id}
                        projectName={project.name}
                        assignedManager={project.assigned_manager}
                        onAssignmentComplete={() => loadProjects()}
                      />
                    </RoleBasedComponent>
                    
                    <RoleBasedComponent allowedRoles={['Admin', 'Project Manager']}>
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <Link to={`/projects/${project.project_id}/structures`}>
                          Structures
                        </Link>
                      </Button>
                    </RoleBasedComponent>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 