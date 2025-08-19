import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { projectsApi, structuresApi, substructureApi } from '@/lib/api';
import { BorelogEntryForm } from '@/components/BorelogEntryForm';
import { Project, Structure, Substructure } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/Loader';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { RoleBasedComponent } from '@/components/RoleBasedComponent';

export default function BorelogEntryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [substructures, setSubstructures] = useState<Substructure[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedStructureId, setSelectedStructureId] = useState<string>('');
  const [selectedSubstructureId, setSelectedSubstructureId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingStructures, setIsLoadingStructures] = useState(false);
  const [isLoadingSubstructures, setIsLoadingSubstructures] = useState(false);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Load structures when project changes
  useEffect(() => {
    if (selectedProjectId) {
      loadStructures(selectedProjectId);
    } else {
      setStructures([]);
      setSubstructures([]);
      setSelectedStructureId('');
      setSelectedSubstructureId('');
    }
  }, [selectedProjectId]);

  // Load substructures when structure changes
  useEffect(() => {
    if (selectedProjectId && selectedStructureId) {
      loadSubstructures(selectedProjectId, selectedStructureId);
    } else {
      setSubstructures([]);
      setSelectedSubstructureId('');
    }
  }, [selectedProjectId, selectedStructureId]);

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const response = await projectsApi.list();
      
      // The API returns { success: true, data: [...] }
      // So we need to access response.data.data, not just response.data
      const projectsData = response.data?.data || [];
      setProjects(projectsData);
    } catch (error: any) {
      console.error('Failed to load projects:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      console.error('Error config:', error.config);
      
      let errorMessage = 'Failed to load projects';
      if (error.response?.status === 404) {
        errorMessage = 'Projects endpoint not found. Please check if the backend is running.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication required. Please log in again.';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot connect to backend server. Please ensure the backend is running on port 3000.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingProjects(false);
      setIsLoading(false);
    }
  };

  const loadStructures = async (projectId: string) => {
    setIsLoadingStructures(true);
    try {
      const response = await structuresApi.getByProject(projectId);
      setStructures(response.data || []);
    } catch (error: any) {
      console.error('Failed to load structures:', error);
      toast({
        title: 'Error',
        description: 'Failed to load structures for this project.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingStructures(false);
    }
  };

  const loadSubstructures = async (projectId: string, structureId: string) => {
    setIsLoadingSubstructures(true);
    try {
      const response = await substructureApi.list(projectId, structureId);
      setSubstructures(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to load substructures:', error);
      toast({
        title: 'Error',
        description: 'Failed to load substructures for this structure.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingSubstructures(false);
    }
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedStructureId('');
    setSelectedSubstructureId('');
  };

  const handleStructureChange = (structureId: string) => {
    setSelectedStructureId(structureId);
    setSelectedSubstructureId('');
  };

  const handleSubstructureChange = (substructureId: string) => {
    setSelectedSubstructureId(substructureId);
  };

  // Check if user has appropriate role
  const canAccess = user?.role === 'Site Engineer' || user?.role === 'Admin' || user?.role === 'Project Manager';

  if (!canAccess) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
              <p className="text-gray-600 mb-4">
                Only Site Engineers, Project Managers, and Admins can access the borelog entry form.
              </p>
              <Button onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="container mx-auto p-6">
      {/* Heading area intentionally left empty (back button removed) */}

      {/* Loading States */}
      {isLoadingProjects && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Loader />
              <span className="ml-2">Loading projects...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoadingStructures && selectedProjectId && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Loader />
              <span className="ml-2">Loading structures...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoadingSubstructures && selectedStructureId && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Loader />
              <span className="ml-2">Loading substructures...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Projects Available */}
      {!isLoadingProjects && projects.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Projects Available</h2>
              <p className="text-gray-600 mb-4">
                You need to be assigned to a project to create borelog entries.
              </p>
              <Button onClick={() => navigate('/projects/list')}>
                View Projects
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Structures Available */}
      {selectedProjectId && !isLoadingStructures && structures.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Structures Available</h2>
              <p className="text-gray-600 mb-4">
                This project doesn't have any structures defined yet.
              </p>
              <Button onClick={() => navigate('/structures/create')}>
                Create Structure
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Substructures Available */}
      {selectedStructureId && !isLoadingSubstructures && substructures.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Substructures Available</h2>
              <p className="text-gray-600 mb-4">
                This structure doesn't have any substructures defined yet.
              </p>
              <Button onClick={() => navigate('/substructures/create')}>
                Create Substructure
              </Button>
            </div>
          </CardContent>
        </Card>
      )}



      {/* Borelog Entry Form */}
      {projects.length > 0 && (
        <RoleBasedComponent allowedRoles={['Site Engineer', 'Admin', 'Project Manager']}>
          <BorelogEntryForm
            projectId={selectedProjectId}
            structureId={selectedStructureId}
            substructureId={selectedSubstructureId}
            projects={projects}
            structures={structures}
            substructures={substructures}
            onProjectChange={handleProjectChange}
            onStructureChange={handleStructureChange}
            onSubstructureChange={handleSubstructureChange}
          />
        </RoleBasedComponent>
      )}
    </div>
  );
}
