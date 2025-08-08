import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, Building2, MapPin, Calendar, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { substructureApi, structureApi, projectApi } from '@/lib/api';
import { Substructure, Structure, Project } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/Loader';
import { RoleBasedComponent } from '@/components/RoleBasedComponent';

export default function SubstructureListPage() {
  const { projectId, structureId } = useParams<{ projectId: string; structureId: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const [substructures, setSubstructures] = useState<Substructure[]>([]);
  const [structure, setStructure] = useState<Structure | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [filteredSubstructures, setFilteredSubstructures] = useState<Substructure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStructure, setIsLoadingStructure] = useState(true);
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
    const loadStructure = async () => {
      if (!structureId) return;
      
      try {
        setIsLoadingStructure(true);
        const response = await structureApi.getById(structureId);
        
        if (response.data && response.data.data) {
          setStructure(response.data.data);
        } else if (response.data) {
          setStructure(response.data);
        }
      } catch (error) {
        console.error('Failed to load structure:', error);
        toast({
          title: 'Error',
          description: 'Failed to load structure details.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingStructure(false);
      }
    };

    loadStructure();
  }, [structureId, toast]);

  useEffect(() => {
    const loadSubstructures = async () => {
      if (!projectId) return;
      
      try {
        setIsLoading(true);
        const response = await substructureApi.list(projectId, structureId);
        
        if (response.data && Array.isArray(response.data.data)) {
          setSubstructures(response.data.data);
        } else if (response.data && Array.isArray(response.data)) {
          setSubstructures(response.data);
        } else {
          console.error('Unexpected substructures response format:', response);
          setSubstructures([]);
        }
      } catch (error) {
        console.error('Failed to load substructures:', error);
        toast({
          title: 'Error',
          description: 'Failed to load substructures. Please try again.',
          variant: 'destructive',
        });
        setSubstructures([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadSubstructures();
  }, [projectId, structureId, toast]);

  // Apply search filter
  useEffect(() => {
    let filtered = substructures;

    if (searchTerm.trim()) {
      filtered = filtered.filter(substructure =>
        substructure.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (substructure.remark && substructure.remark.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredSubstructures(filtered);
  }, [substructures, searchTerm]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getSubstructureTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'P1': 'bg-blue-100 text-blue-800',
      'P2': 'bg-blue-100 text-blue-800',
      'M': 'bg-green-100 text-green-800',
      'E': 'bg-purple-100 text-purple-800',
      'Abutment1': 'bg-orange-100 text-orange-800',
      'Abutment2': 'bg-orange-100 text-orange-800',
      'LC': 'bg-red-100 text-red-800',
      'Right side': 'bg-gray-100 text-gray-800',
      'Left side': 'bg-gray-100 text-gray-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (isLoadingProject || isLoadingStructure || isLoading) {
    return <Loader />;
  }

  if (!project || !structure) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
        <div className="max-w-7xl mx-auto">
          <Card className="shadow-form">
            <CardContent className="pt-6 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Project or Structure not found</h3>
              <p className="text-muted-foreground mb-4">
                The project or structure you're looking for doesn't exist or you don't have access to it.
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
            <Link to={`/projects/${projectId}/structures`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Structures
            </Link>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              Substructures
            </h1>
            <p className="text-muted-foreground">
              {project.name} • {structure.type} • Manage substructures and components
            </p>
          </div>
          
          <RoleBasedComponent allowedRoles={['Admin', 'Project Manager']}>
            <Button className="bg-gradient-to-r from-primary to-primary-glow hover:shadow-elegant transition-all duration-300" asChild>
              <Link to={`/projects/${projectId}/structures/${structureId}/substructures/create`}>
                <Plus className="h-4 w-4 mr-2" />
                Add Substructure
              </Link>
            </Button>
          </RoleBasedComponent>
        </div>

        {/* Search */}
        <Card className="shadow-form mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Input
                placeholder="Search substructures by type or remark..."
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
            Showing {filteredSubstructures.length} of {substructures.length} substructures
            {searchTerm.trim() && ' (filtered)'}
          </p>
        </div>

        {/* Substructures Grid */}
        {filteredSubstructures.length === 0 ? (
          <Card className="shadow-form">
            <CardContent className="pt-6 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No substructures found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm.trim() 
                  ? 'No substructures match your search criteria.'
                  : 'No substructures have been added to this structure yet.'
                }
              </p>
              <RoleBasedComponent allowedRoles={['Admin', 'Project Manager']}>
                <Button asChild>
                  <Link to={`/projects/${projectId}/structures/${structureId}/substructures/create`}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Substructure
                  </Link>
                </Button>
              </RoleBasedComponent>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSubstructures.map((substructure) => (
              <Card key={substructure.substructure_id} className="shadow-form hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{substructure.type}</CardTitle>
                    <Badge className={getSubstructureTypeColor(substructure.type)}>
                      {substructure.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {substructure.remark && (
                      <p className="text-sm text-muted-foreground">
                        {substructure.remark}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Created {formatDate(substructure.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <Link to={`/projects/${projectId}/structures/${structureId}/substructures/create`}>
                        Add / Edit
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <Link to="/borelog/manage">Manage Borelogs</Link>
                    </Button>
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