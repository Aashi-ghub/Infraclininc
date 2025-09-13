import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Building2, MapPin, Calendar, Users, CheckCircle } from 'lucide-react';
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

interface ProjectWithAssignments extends Project {
  assignment_count?: number;
}

export default function ProjectListPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectWithAssignments[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectWithAssignments[]>([]);
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
              {user?.role === 'Site Engineer' && ' (My Assignments)'}
            </h1>
            <p className="text-muted-foreground">
              {user?.role === 'Site Engineer' 
                ? 'View projects and your assigned borelogs'
                : 'Manage your infrastructure projects and assignments'
              }
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
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search projects by name or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <Card className="shadow-form">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No projects found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm 
                    ? 'No projects match your search criteria.'
                    : user?.role === 'Site Engineer'
                    ? 'You don\'t have any project assignments yet.'
                    : 'No projects have been created yet.'
                  }
                </p>
                {!searchTerm && user?.role !== 'Site Engineer' && (
                  <Button asChild>
                    <Link to="/projects/create">
                      <Plus className="h-4 w-4 mr-2" />
                      Create your first project
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <Card key={project.project_id} className="shadow-form hover:shadow-lg transition-all duration-300 group">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors">
                        {project.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        {project.location || 'No location specified'}
                      </div>
                    </div>
                    {user?.role === 'Site Engineer' && project.assignment_count && project.assignment_count > 0 && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {project.assignment_count} {project.assignment_count === 1 ? 'assignment' : 'assignments'}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Created {formatDate(project.created_at)}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button asChild variant="outline" className="flex-1">
                      <Link to={`/borelog/manage?project=${project.project_id}`}>
                        View Borelogs
                      </Link>
                    </Button>
                    
                    <RoleBasedComponent allowedRoles={['Admin', 'Project Manager']}>
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/projects/${project.project_id}/structures`}>
                          Structures
                        </Link>
                      </Button>
                    </RoleBasedComponent>
                  </div>
                  
                  {user?.role === 'Site Engineer' && (!project.assignment_count || project.assignment_count === 0) && (
                    <div className="mt-3 p-2 bg-muted rounded-md">
                      <p className="text-xs text-muted-foreground text-center">
                        No assignments in this project
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 