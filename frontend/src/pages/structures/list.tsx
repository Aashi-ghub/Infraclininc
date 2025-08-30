import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, Building2, MapPin, Calendar, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { structureApi, projectApi, borelogApiV2 } from '@/lib/api';
import { Structure, Project } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/Loader';
import { RoleBasedComponent } from '@/components/RoleBasedComponent';

export default function StructureListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const [structures, setStructures] = useState<Structure[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [filteredStructures, setFilteredStructures] = useState<Structure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) return;
      
      try {
        setIsLoadingProject(true);
        const response = await projectApi.getById(projectId);
        
        if (response.data && response.data.data) {
          setProject(response.data.data);
        } else if (response.data) {
          setProject(response.data);
        }
      } catch (error) {
        console.error('Failed to load project:', error);
        toast({
          title: 'Error',
          description: 'Failed to load project details.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingProject(false);
      }
    };

    loadProject();
  }, [projectId, toast]);

  useEffect(() => {
    const loadStructures = async () => {
      if (!projectId) return;
      
      try {
        setIsLoading(true);
        const response = await borelogApiV2.getFormData({ project_id: projectId });
        const formData = response.data.data;
        setStructures(formData.structures_by_project[projectId] || []);
      } catch (error) {
        console.error('Failed to load structures:', error);
        toast({
          title: 'Error',
          description: 'Failed to load structures. Please try again.',
          variant: 'destructive',
        });
        setStructures([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadStructures();
  }, [projectId, toast]);

  // Apply search filter
  useEffect(() => {
    let filtered = structures;

    if (searchTerm.trim()) {
      filtered = filtered.filter(structure =>
        structure.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (structure.description && structure.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredStructures(filtered);
  }, [structures, searchTerm]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStructureTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'Tunnel': 'bg-blue-100 text-blue-800',
      'Bridge': 'bg-green-100 text-green-800',
      'Viaduct': 'bg-purple-100 text-purple-800',
      'Embankment': 'bg-orange-100 text-orange-800',
      'Building': 'bg-gray-100 text-gray-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (isLoadingProject || isLoading) {
    return <Loader />;
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
        <div className="max-w-7xl mx-auto">
          <Card className="shadow-form">
            <CardContent className="pt-6 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Project not found</h3>
              <p className="text-muted-foreground mb-4">
                The project you're looking for doesn't exist or you don't have access to it.
              </p>
              <Button asChild>
                <Link to="/projects">
                  Back to Projects
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/projects">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Link>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              Structures
            </h1>
            <p className="text-muted-foreground">
              {project.name} • Manage project structures and components
            </p>
          </div>
          
          <RoleBasedComponent allowedRoles={['Admin', 'Project Manager']}>
            <Button className="bg-gradient-to-r from-primary to-primary-glow hover:shadow-elegant transition-all duration-300" asChild>
              <Link to={`/projects/${projectId}/structures/create`}>
                <Plus className="h-4 w-4 mr-2" />
                Add Structure
              </Link>
            </Button>
          </RoleBasedComponent>
        </div>

        {/* Search */}
        <Card className="shadow-form mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Input
                placeholder="Search structures by type or description..."
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
            Showing {filteredStructures.length} of {structures.length} structures
            {searchTerm.trim() && ' (filtered)'}
          </p>
        </div>

        {/* Structures Grid */}
        {filteredStructures.length === 0 ? (
          <Card className="shadow-form">
            <CardContent className="pt-6 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No structures found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm.trim() 
                  ? 'No structures match your search criteria.'
                  : 'No structures have been added to this project yet.'
                }
              </p>
              <RoleBasedComponent allowedRoles={['Admin', 'Project Manager']}>
                <Button asChild>
                  <Link to={`/projects/${projectId}/structures/create`}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Structure
                  </Link>
                </Button>
              </RoleBasedComponent>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStructures.map((structure) => (
              <Card key={structure.structure_id} className="shadow-form hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{structure.type}</CardTitle>
                    <Badge className={getStructureTypeColor(structure.type)}>
                      {structure.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {structure.description && (
                      <p className="text-sm text-muted-foreground">
                        {structure.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Created {formatDate(structure.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <Link to={`/projects/${projectId}/structures/${structure.structure_id}/substructures`}>
                        Substructures
                      </Link>
                    </Button>
                    
                    <RoleBasedComponent allowedRoles={['Admin', 'Project Manager']}>
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <Link to={`/projects/${projectId}/structures/${structure.structure_id}/edit`}>
                          Edit
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