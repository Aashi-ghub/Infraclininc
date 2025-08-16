import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { projectsApi, structuresApi, boreholesApi } from '@/lib/api';
import { BorelogEntryForm } from '@/components/BorelogEntryForm';
import { Project, Structure, Borehole } from '@/lib/types';
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
  const [boreholes, setBoreholes] = useState<Borehole[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedStructureId, setSelectedStructureId] = useState<string>('');
  const [selectedBoreholeId, setSelectedBoreholeId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingStructures, setIsLoadingStructures] = useState(false);
  const [isLoadingBoreholes, setIsLoadingBoreholes] = useState(false);

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
      setBoreholes([]);
      setSelectedStructureId('');
      setSelectedBoreholeId('');
    }
  }, [selectedProjectId]);

  // Load boreholes when structure changes
  useEffect(() => {
    if (selectedProjectId && selectedStructureId) {
      loadBoreholes(selectedProjectId, selectedStructureId);
    } else {
      setBoreholes([]);
      setSelectedBoreholeId('');
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

  const loadBoreholes = async (projectId: string, structureId: string) => {
    setIsLoadingBoreholes(true);
    try {
      const response = await boreholesApi.getByProjectAndStructure(projectId, structureId);
      setBoreholes(response.data || []);
    } catch (error: any) {
      console.error('Failed to load boreholes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load boreholes for this structure.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingBoreholes(false);
    }
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedStructureId('');
    setSelectedBoreholeId('');
  };

  const handleStructureChange = (structureId: string) => {
    setSelectedStructureId(structureId);
    setSelectedBoreholeId('');
  };

  const handleBoreholeChange = (boreholeId: string) => {
    setSelectedBoreholeId(boreholeId);
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Borelog Entry</h1>
          <p className="text-gray-600 mt-1">
            Create and submit borelog entries following the specimen field log format
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/borelog/manage')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Borelog Management
        </Button>
      </div>

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

      {isLoadingBoreholes && selectedStructureId && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Loader />
              <span className="ml-2">Loading boreholes...</span>
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

      {/* No Boreholes Available */}
      {selectedStructureId && !isLoadingBoreholes && boreholes.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Boreholes Available</h2>
              <p className="text-gray-600 mb-4">
                This structure doesn't have any boreholes defined yet.
              </p>
              <Button onClick={() => navigate('/boreholes/create')}>
                Create Borehole
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
            boreholeId={selectedBoreholeId}
            projects={projects}
            structures={structures}
            boreholes={boreholes}
            onProjectChange={handleProjectChange}
            onStructureChange={handleStructureChange}
            onBoreholeChange={handleBoreholeChange}
          />
        </RoleBasedComponent>
      )}
    </div>
  );
}
