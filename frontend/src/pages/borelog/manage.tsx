import { useState, useEffect } from 'react';
import { Search, Plus, Building, MapPin, Drill, Upload, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { actualBorelogApi, projectApi } from '@/lib/api';
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSubstructures, setIsLoadingSubstructures] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  
  // Filter states
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
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
          project_location: selectedProjectData.location
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
            project_location: selectedProjectData.location
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
            <h1 className="text-3xl font-bold text-foreground mb-2">Manage Borelogs</h1>
            <p className="text-muted-foreground">
              View and manage borelog details for your projects
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              className="bg-gradient-to-r from-primary to-primary-glow hover:shadow-elegant transition-all duration-300"
              onClick={() => setShowCSVUpload(!showCSVUpload)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </Button>
            {(user?.role === 'Admin' || user?.role === 'Project Manager') && (
              <Button 
                className="bg-gradient-to-r from-primary to-primary-glow hover:shadow-elegant transition-all duration-300"
                onClick={() => setShowAssignments(!showAssignments)}
              >
                <Users className="h-4 w-4 mr-2" />
                Manage Assignments
              </Button>
            )}
            <Button className="bg-gradient-to-r from-primary to-primary-glow hover:shadow-elegant transition-all duration-300" asChild>
              <Link to="/borelog/entry">
                <Plus className="h-4 w-4 mr-2" />
                Create New Borelog
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </CardContent>
        </Card>

        {/* CSV Upload Section */}
        {showCSVUpload && (
          <Card className="shadow-form mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Upload Geological Logs via CSV
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
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-semibold">
                                Borelog #{borelog.number}
                              </h5>
                              <p className="text-sm text-muted-foreground">
                                {borelog.structure_type} - {borelog.substructure_type}
                              </p>
                            </div>
                            <Button variant="outline" size="sm">
                              Manage Assignments
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
                      <TableHead>Borelog Number</TableHead>
                      <TableHead>Structure/Substructure</TableHead>
                      <TableHead>Depth (m)</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBorelogs.map((borelog) => (
                      <TableRow key={borelog.borelog_id}>
                        <TableCell className="font-medium">
                          {borelog.number}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <Building className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{borelog.structure_type}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{borelog.substructure_type}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {borelog.termination_depth} m
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            v{borelog.version_no}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{borelog.created_by_name}</span>
                            <span className="text-xs text-muted-foreground">{borelog.created_by_email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <Link to={`/borelog/${borelog.borelog_id}`}>
                                View
                              </Link>
                            </Button>
                            {(user?.role === 'Admin' || user?.role === 'Project Manager' || user?.role === 'Site Engineer') && (
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                              >
                                <Link to={`/borelog/edit/${borelog.borelog_id}`}>
                                  Edit
                                </Link>
                              </Button>
                            )}
                            {(user?.role === 'Admin' || user?.role === 'Project Manager') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setShowAssignments(true);
                                  setSelectedBorelogForAssignment(borelog.borelog_id);
                                }}
                              >
                                <Users className="h-3 w-3 mr-1" />
                                Assign
                              </Button>
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