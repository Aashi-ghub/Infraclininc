import { useState, useEffect } from 'react';
import { Search, Plus, Building, MapPin, Drill, Upload, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { actualBorelogApi, projectApi, structureApi, substructureApi, boreholeApi, borelogApiV2 } from '@/lib/api';
import { Loader } from '@/components/Loader';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Project } from '@/lib/types';
import { BorelogCSVUpload } from '@/components/BorelogCSVUpload';
import { BorelogAssignmentManager } from '@/components/BorelogAssignmentManager';

export default function ManageBorelogs() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [borelogs, setBorelogs] = useState<any[]>([]);
  const [filteredBorelogs, setFilteredBorelogs] = useState<any[]>([]);
  const [substructures, setSubstructures] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSubstructures, setIsLoadingSubstructures] = useState(true);
  const [isLoadingStructures, setIsLoadingStructures] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  
  // Filter states
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedStructure, setSelectedStructure] = useState<string | undefined>(undefined);
  const [selectedSubstructure, setSelectedSubstructure] = useState<string | undefined>(undefined);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [showAssignments, setShowAssignments] = useState(false);
  const [selectedBorelogForAssignment, setSelectedBorelogForAssignment] = useState<string | null>(null);



  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setIsLoadingProjects(true);
        const response = await projectApi.list();
        console.log('Projects response:', response);
        
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
        setIsLoadingProjects(false);
      }
    };

    loadProjects();
  }, [toast]);

  // Load structures when project is selected
  useEffect(() => {
    const loadStructures = async () => {
      if (selectedProject === 'all') {
        setStructures([]);
        setSelectedStructure(undefined);
        setSelectedSubstructure(undefined);
        setIsLoadingStructures(false);
        return;
      }

      try {
        setIsLoadingStructures(true);
        const selectedProjectData = projects.find(p => p.name === selectedProject);
        if (!selectedProjectData) {
          setStructures([]);
          return;
        }

        const response = await borelogApiV2.getFormData({ project_id: selectedProjectData.project_id });
        const formData = response.data.data;
        setStructures(formData.structures_by_project[selectedProjectData.project_id] || []);
      } catch (error) {
        console.error('Failed to load structures:', error);
        setStructures([]);
      } finally {
        setIsLoadingStructures(false);
      }
    };

    loadStructures();
  }, [selectedProject, projects]);

  // Load substructures when structure is selected
  useEffect(() => {
    const loadSubstructures = async () => {
      if (!selectedStructure || selectedProject === 'all') {
        setSubstructures([]);
        setSelectedSubstructure(undefined);
        setIsLoadingSubstructures(false);
        return;
      }

      try {
        setIsLoadingSubstructures(true);
        const selectedProjectData = projects.find(p => p.name === selectedProject);
        if (!selectedProjectData) {
          setSubstructures([]);
          return;
        }

        const response = await borelogApiV2.getFormData({ project_id: selectedProjectData.project_id, structure_id: selectedStructure });
        const formData = response.data.data;
        setSubstructures(formData.substructures_by_structure[selectedStructure] || []);
      } catch (error) {
        console.error('Failed to load substructures:', error);
        setSubstructures([]);
      } finally {
        setIsLoadingSubstructures(false);
      }
    };

    loadSubstructures();
  }, [selectedStructure, selectedProject, projects]);



  // Load borelogs for selected project
  useEffect(() => {
    const loadBorelogs = async () => {
      if (selectedProject === 'all') {
        setBorelogs([]);
        setFilteredBorelogs([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        // Find the project ID from the selected project name
        const selectedProjectData = projects.find(p => p.name === selectedProject);
        if (!selectedProjectData) {
          console.error('Project not found:', selectedProject);
          setBorelogs([]);
          setFilteredBorelogs([]);
          return;
        }

        console.log('Loading borelogs for project:', selectedProject, 'ID:', selectedProjectData.project_id);
        const response = await actualBorelogApi.getByProject(selectedProjectData.project_id);
        console.log('Borelogs response:', response);
        
        let borelogs: any[] = [];
        
        if (response.data && response.data.data && response.data.data.borelogs) {
          // Handle the new flat array format
          borelogs = response.data.data.borelogs;
        } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
          // Handle the old flat array format (fallback)
          borelogs = response.data.data;
        } else {
          console.error('Unexpected response format:', response);
          setBorelogs([]);
          setFilteredBorelogs([]);
          return;
        }

        // Transform the data to ensure consistent structure
        const transformedBorelogs = borelogs.map(borelog => ({
          ...borelog,
          // Ensure we have the basic fields
          number: borelog.number || borelog.details?.number || `BH-${borelog.borelog_id?.slice(0, 8)}`,
          structure_type: borelog.structure_type || borelog.structure?.type || 'Unknown',
          substructure_type: borelog.substructure_type || borelog.substructure?.type || 'Unknown',
          termination_depth: borelog.termination_depth || borelog.details?.termination_depth || 0,
          version_no: borelog.version_no || 1,
          created_by_name: borelog.created_by_name || borelog.created_by?.name || 'Unknown',
          created_by_email: borelog.created_by_email || borelog.created_by?.email || '',
          // Add project info for context
          project_name: selectedProjectData.name,
          project_location: selectedProjectData.location,
          // Assignment information
          assignment_id: borelog.assignment_id || null,
          assigned_site_engineer: borelog.assigned_site_engineer || null,
          assignment_status: borelog.assignment_status || null,
          assigned_site_engineer_name: borelog.assigned_site_engineer_name || null,
          assigned_site_engineer_email: borelog.assigned_site_engineer_email || null
        }));

        setBorelogs(transformedBorelogs);
        setFilteredBorelogs(transformedBorelogs);
      } catch (error) {
        console.error('Failed to load borelogs:', error);
        toast({
          title: 'Error',
          description: 'Failed to load borelogs. Please try again.',
          variant: 'destructive',
        });
        setBorelogs([]);
        setFilteredBorelogs([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadBorelogs();
  }, [selectedProject, projects, toast]);

  // Load substructures
  useEffect(() => {
    const loadSubstructures = async () => {
      try {
        setIsLoadingSubstructures(true);
        // Mock substructures data (replace with real API call)
        const mockSubstructures: any[] = [
          { id: 'sub-1', name: 'Pier Foundation P1', type: 'Pier' },
          { id: 'sub-2', name: 'Abutment A1', type: 'Abutment' },
          { id: 'sub-3', name: 'Pier Foundation P2', type: 'Pier' },
          { id: 'sub-4', name: 'Retaining Wall RW1', type: 'Retaining Wall' },
        ];
        setSubstructures(mockSubstructures);
      } catch (error) {
        console.error('Failed to load substructures:', error);
        toast({
          title: 'Error',
          description: 'Failed to load substructures.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingSubstructures(false);
      }
    };

    loadSubstructures();
  }, [toast]);

  // Apply search filter
  useEffect(() => {
    let filtered = borelogs;

    if (searchFilter.trim()) {
      filtered = filtered.filter(borelog =>
        borelog.number?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        borelog.structure_type?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        borelog.substructure_type?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        borelog.created_by_name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (borelog.termination_depth !== undefined && borelog.termination_depth.toString().includes(searchFilter.toLowerCase()))
      );
    }

    setFilteredBorelogs(filtered);
  }, [borelogs, searchFilter]);

  const handleBorelogUpdate = (updatedBorelog: any) => {
    setBorelogs(prevBorelogs =>
      prevBorelogs.map(borelog =>
        borelog.borelog_id === updatedBorelog.borelog_id ? updatedBorelog : borelog
      )
    );
  };

  const handleBorelogDelete = (deletedBorelogId: string) => {
    setBorelogs(prevBorelogs => 
      prevBorelogs.filter(borelog => borelog.borelog_id !== deletedBorelogId)
    );
    setFilteredBorelogs(prevFilteredBorelogs => 
      prevFilteredBorelogs.filter(borelog => borelog.borelog_id !== deletedBorelogId)
    );
  };

  const handleCSVUploadSuccess = () => {
    // Refresh the borelogs list after successful upload
    if (selectedProject !== 'all') {
      const loadBorelogs = async () => {
        try {
          setIsLoading(true);
          const selectedProjectData = projects.find(p => p.name === selectedProject);
          if (!selectedProjectData) {
            console.error('Project not found:', selectedProject);
            return;
          }
          
          const response = await actualBorelogApi.getByProject(selectedProjectData.project_id);
          
          let borelogs: any[] = [];
          
          if (response.data && response.data.data && response.data.data.borelogs) {
            borelogs = response.data.data.borelogs;
          } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
            borelogs = response.data.data;
          }

          // Transform the data to ensure consistent structure
          const transformedBorelogs = borelogs.map(borelog => ({
            ...borelog,
            number: borelog.number || borelog.details?.number || `BH-${borelog.borelog_id?.slice(0, 8)}`,
            structure_type: borelog.structure_type || borelog.structure?.type || 'Unknown',
            substructure_type: borelog.substructure_type || borelog.substructure?.type || 'Unknown',
            termination_depth: borelog.termination_depth || borelog.details?.termination_depth || 0,
            version_no: borelog.version_no || 1,
            created_by_name: borelog.created_by_name || borelog.created_by?.name || 'Unknown',
            created_by_email: borelog.created_by_email || borelog.created_by?.email || '',
            project_name: selectedProjectData.name,
            project_location: selectedProjectData.location,
            // Assignment information
            assignment_id: borelog.assignment_id || null,
            assigned_site_engineer: borelog.assigned_site_engineer || null,
            assignment_status: borelog.assignment_status || null,
            assigned_site_engineer_name: borelog.assigned_site_engineer_name || null,
            assigned_site_engineer_email: borelog.assigned_site_engineer_email || null
          }));

          setBorelogs(transformedBorelogs);
          setFilteredBorelogs(transformedBorelogs);
        } catch (error) {
          console.error('Failed to refresh borelogs:', error);
        } finally {
          setIsLoading(false);
        }
      };
      loadBorelogs();
    }
    setShowCSVUpload(false);
  };

  const getSubstructureName = (substructureId?: string) => {
    if (!substructureId) return 'Not assigned';
    const substructure = substructures.find(s => s.id === substructureId);
    return substructure ? `${substructure.name} (${substructure.type})` : 'Unknown';
  };

  const handleQuickAssign = async (borelogId: string, substructureId: string) => {
    try {
      // For now, we'll just update the local state since the actual borelog API doesn't have an update endpoint
      // TODO: Implement proper borelog update API endpoint
      setBorelogs(prevBorelogs =>
        prevBorelogs.map(borelog =>
          borelog.borelog_id === borelogId 
            ? { ...borelog, substructure_id: substructureId === 'none' ? undefined : substructureId }
            : borelog
        )
      );

      toast({
        title: 'Success',
        description: 'Borelog assignment updated successfully!',
      });
    } catch (error) {
      console.error('Failed to update assignment:', error);
      toast({
        title: 'Error',
        description: 'Failed to update assignment. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Manage Borelogs</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              View and manage borelog details for your projects
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
              className="bg-gradient-to-r from-primary to-primary-glow hover:shadow-elegant transition-all duration-300 w-full sm:w-auto"
              onClick={() => setShowCSVUpload(!showCSVUpload)}
            >
              <Upload className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Upload CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            {(user?.role === 'Admin' || user?.role === 'Project Manager') && (
              <Button 
                className="bg-gradient-to-r from-primary to-primary-glow hover:shadow-elegant transition-all duration-300 w-full sm:w-auto"
                onClick={() => setShowAssignments(!showAssignments)}
              >
                <Users className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Manage Assignments</span>
                <span className="sm:hidden">Assignments</span>
              </Button>
            )}
            <Button className="bg-gradient-to-r from-primary to-primary-glow hover:shadow-elegant transition-all duration-300 w-full sm:w-auto" asChild>
              <Link to="/borelog/entry">
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Create New Borelog</span>
                <span className="sm:hidden">New Borelog</span>
              </Link>
            </Button>
          </div>
        </div>



        {/* Filters */}
        <Card className="shadow-form mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              Project Selection & Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Project Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Project</label>
                <Select value={selectedProject} onValueChange={setSelectedProject} disabled={isLoadingProjects}>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingProjects ? "Loading projects..." : "Select a project"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Select a project...</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.project_id} value={project.name}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Structure Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Structure</label>
                <Select value={selectedStructure || ''} onValueChange={setSelectedStructure} disabled={isLoadingStructures || selectedProject === 'all'}>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingStructures ? "Loading structures..." : "Select a structure"} />
                  </SelectTrigger>
                  <SelectContent>
                    {structures.length === 0 && !isLoadingStructures && (
                      <SelectItem value="no-data" disabled>
                        No structures available
                      </SelectItem>
                    )}
                    {structures.map((structure) => (
                      <SelectItem key={structure.structure_id} value={structure.structure_id}>
                        {structure.type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Substructure Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Substructure</label>
                <Select value={selectedSubstructure || ''} onValueChange={setSelectedSubstructure} disabled={isLoadingSubstructures || !selectedStructure}>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingSubstructures ? "Loading substructures..." : "Select a substructure"} />
                  </SelectTrigger>
                  <SelectContent>
                    {substructures.length === 0 && !isLoadingSubstructures && (
                      <SelectItem value="no-data" disabled>
                        No substructures available
                      </SelectItem>
                    )}
                    {substructures.map((substructure) => (
                      <SelectItem key={(substructure.substructure_id || substructure.id)} value={(substructure.substructure_id || substructure.id)}>
                        {substructure.type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              {/* Search Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by borelog number, coordinates, depth..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-10"
                    disabled={selectedProject === 'all'}
                  />
                </div>
              </div>
            </div>

            {/* Selection Status */}
            {showCSVUpload && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <h4 className="text-sm font-medium mb-2">Upload Requirements:</h4>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 text-sm">
                  <div className={`flex items-center gap-2 ${selectedProject !== 'all' ? 'text-green-600' : 'text-red-600'}`}>
                    <div className={`w-2 h-2 rounded-full ${selectedProject !== 'all' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    Project: {selectedProject !== 'all' ? 'Selected' : 'Required'}
                  </div>
                  <div className={`flex items-center gap-2 ${selectedStructure ? 'text-green-600' : 'text-red-600'}`}>
                    <div className={`w-2 h-2 rounded-full ${selectedStructure ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    Structure: {selectedStructure ? 'Selected' : 'Required'}
                  </div>
                  <div className={`flex items-center gap-2 ${selectedSubstructure ? 'text-green-600' : 'text-red-600'}`}>
                    <div className={`w-2 h-2 rounded-full ${selectedSubstructure ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    Substructure: {selectedSubstructure ? 'Selected' : 'Required'}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CSV Upload Section */}
        {showCSVUpload && (
          <Card className="shadow-form mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Upload Borelogs via CSV
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BorelogCSVUpload 
                projects={projects} 
                onUploadSuccess={handleCSVUploadSuccess}
                selectedProjectId={
                  // Map current selection (by name) to the project_id expected by uploader
                  selectedProject === 'all' 
                    ? undefined 
                    : (projects.find(p => p.name === selectedProject)?.project_id)
                }
                selectedStructureId={selectedStructure}
                selectedSubstructureId={selectedSubstructure}
              />
            </CardContent>
          </Card>
        )}

        {/* Assignments Section */}
        {showAssignments && (user?.role === 'Admin' || user?.role === 'Project Manager') && (
          <Card className="shadow-form mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Site Engineer Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedProject === 'all' ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a Project First</h3>
                  <p className="text-muted-foreground">
                    Please select a project from the dropdown above to manage site engineer assignments.
                  </p>
                </div>
              ) : selectedBorelogForAssignment ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold">Assignments for Selected Borelog</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedBorelogForAssignment(null)}
                    >
                      Back to List
                    </Button>
                  </div>
                  <BorelogAssignmentManager
                    borelogId={selectedBorelogForAssignment}
                    projectId={projects.find(p => p.name === selectedProject)?.project_id}
                    onAssignmentComplete={() => {
                      // Refresh data if needed
                      toast({
                        title: 'Success',
                        description: 'Assignment updated successfully.',
                      });
                    }}
                  />
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <h4 className="text-lg font-semibold mb-2">Select a Borelog to Manage Assignments</h4>
                    <p className="text-muted-foreground">
                      Click on a borelog below to assign site engineers or manage existing assignments.
                    </p>
                  </div>
                  {isLoading ? (
                    <div className="text-center py-8">
                      <Loader size="lg" text="Loading borelogs..." />
                    </div>
                  ) : filteredBorelogs.length === 0 ? (
                    <div className="text-center py-8">
                      <Drill className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No borelogs available</h3>
                      <p className="text-muted-foreground">
                        Create borelogs first to assign site engineers.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {filteredBorelogs.map((borelog) => (
                        <div
                          key={borelog.borelog_id}
                          className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedBorelogForAssignment(borelog.borelog_id)}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex-1">
                              <h5 className="font-semibold">
                                Borelog #{borelog.number}
                              </h5>
                              <p className="text-sm text-muted-foreground">
                                {borelog.structure_type} - {borelog.substructure_type}
                              </p>
                            </div>
                            <Button variant="outline" size="sm" className="w-full sm:w-auto">
                              <span className="hidden sm:inline">Manage Assignments</span>
                              <span className="sm:hidden">Manage</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Results Summary */}
        {selectedProject !== 'all' && !isLoading && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              Showing {filteredBorelogs.length} of {borelogs.length} borelogs
              {searchFilter.trim() && ' (filtered)'}
            </p>
          </div>
        )}

        {/* Table */}
        <Card className="shadow-form">
          <CardContent className="p-0">
            {selectedProject === 'all' ? (
              <div className="p-8 text-center">
                <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select a Project</h3>
                <p className="text-muted-foreground">
                  Choose a project from the dropdown above to view and manage its borelogs.
                </p>
              </div>
            ) : isLoading ? (
              <div className="p-8 text-center">
                <Loader size="lg" text="Loading borelogs..." />
              </div>
            ) : filteredBorelogs.length === 0 ? (
              <div className="p-8 text-center">
                <Drill className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No borelogs found</h3>
                <p className="text-muted-foreground mb-4">
                  {borelogs.length === 0 
                    ? 'This project has no borelogs yet.'
                    : 'No borelogs match your search criteria.'
                  }
                </p>
                <div className="flex gap-2">
                  <Button 
                    className="bg-gradient-to-r from-primary to-primary-glow"
                    onClick={() => setShowCSVUpload(true)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload CSV
                  </Button>
                  <Button className="bg-gradient-to-r from-primary to-primary-glow" asChild>
                    <Link to="/borelog/entry">
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Borelog
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Borelog Number</TableHead>
                      <TableHead className="min-w-[150px]">Structure/Substructure</TableHead>
                      <TableHead className="min-w-[80px]">Depth (m)</TableHead>
                      <TableHead className="min-w-[80px]">Version</TableHead>
                      <TableHead className="min-w-[150px] hidden md:table-cell">Created By</TableHead>
                      <TableHead className="min-w-[200px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBorelogs.map((borelog) => (
                      <TableRow key={borelog.borelog_id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="font-medium">{borelog.number}</span>
                            <span className="text-xs text-muted-foreground md:hidden">
                              {borelog.created_by_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <Building className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm truncate">{borelog.structure_type}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-xs text-muted-foreground truncate">{borelog.substructure_type}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap">{borelog.termination_depth} m</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap">
                            v{borelog.version_no}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{borelog.created_by_name}</span>
                            <span className="text-xs text-muted-foreground">{borelog.created_by_email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="flex-1 min-w-0"
                              >
                                <Link to={`/borelog/${borelog.borelog_id}`}>
                                  <span className="hidden sm:inline">View</span>
                                  <span className="sm:hidden">👁</span>
                                </Link>
                              </Button>
                              {(user?.role === 'Admin' || user?.role === 'Project Manager' || user?.role === 'Site Engineer') && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  className="flex-1 min-w-0"
                                >
                                  <Link to={`/borelog/edit/${borelog.borelog_id}`}>
                                    <span className="hidden sm:inline">Edit</span>
                                    <span className="sm:hidden">✏</span>
                                  </Link>
                                </Button>
                              )}
                            </div>
                            {(user?.role === 'Admin' || user?.role === 'Project Manager') && (
                              borelog.assignment_id ? (
                                <div className="flex flex-col gap-1">
                                  <div className="text-xs text-muted-foreground">
                                    Assigned to:
                                  </div>
                                  <div className="text-sm font-medium truncate">
                                    {borelog.assigned_site_engineer_name}
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setShowAssignments(true);
                                      setSelectedBorelogForAssignment(borelog.borelog_id);
                                    }}
                                    className="w-full"
                                  >
                                    <Users className="h-3 w-3 mr-1 flex-shrink-0" />
                                    <span className="hidden sm:inline">Manage</span>
                                    <span className="sm:hidden">Manage</span>
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setShowAssignments(true);
                                    setSelectedBorelogForAssignment(borelog.borelog_id);
                                  }}
                                  className="w-full"
                                >
                                  <Users className="h-3 w-3 mr-1 flex-shrink-0" />
                                  <span className="hidden sm:inline">Assign</span>
                                  <span className="sm:hidden">Assign</span>
                                </Button>
                              )
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}