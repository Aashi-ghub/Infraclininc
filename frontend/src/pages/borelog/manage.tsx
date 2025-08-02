import { useState, useEffect } from 'react';
import { Search, Plus, Building, MapPin, Drill, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { borelogApi, projectApi } from '@/lib/api';
import { BorelogEditModal, type Borelog, type Substructure } from '@/components/BorelogEditModal';
import { Loader } from '@/components/Loader';
import { Link } from 'react-router-dom';
import { DeleteBorelogButton } from '@/components/DeleteBorelogButton';
import { useAuth } from '@/lib/auth';
import { Project } from '@/lib/types';
import { BorelogCSVUpload } from '@/components/BorelogCSVUpload';

export default function ManageBorelogs() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [borelogs, setBorelogs] = useState<Borelog[]>([]);
  const [filteredBorelogs, setFilteredBorelogs] = useState<Borelog[]>([]);
  const [substructures, setSubstructures] = useState<Substructure[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSubstructures, setIsLoadingSubstructures] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  
  // Filter states
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [showCSVUpload, setShowCSVUpload] = useState(false);

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
        console.log('Loading geological logs for project:', selectedProject);
        const response = await borelogApi.getByProject(selectedProject);
        console.log('Geological logs response:', response);
        
        if (response.data && Array.isArray(response.data.data)) {
          setBorelogs(response.data.data);
          setFilteredBorelogs(response.data.data);
        } else if (response.data && Array.isArray(response.data)) {
          setBorelogs(response.data);
          setFilteredBorelogs(response.data);
        } else {
          console.error('Unexpected response format:', response);
          setBorelogs([]);
          setFilteredBorelogs([]);
        }
      } catch (error) {
        console.error('Failed to load geological logs:', error);
        toast({
          title: 'Error',
          description: 'Failed to load geological logs. Please try again.',
          variant: 'destructive',
        });
        setBorelogs([]);
        setFilteredBorelogs([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadBorelogs();
  }, [selectedProject, toast]);

  // Load substructures
  useEffect(() => {
    const loadSubstructures = async () => {
      try {
        setIsLoadingSubstructures(true);
        // Mock substructures data (replace with real API call)
        const mockSubstructures: Substructure[] = [
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
        borelog.borehole_number?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        borelog.borehole_location?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (borelog.chainage_km !== undefined && borelog.chainage_km.toString().includes(searchFilter.toLowerCase()))
      );
    }

    setFilteredBorelogs(filtered);
  }, [borelogs, searchFilter]);

  const handleBorelogUpdate = (updatedBorelog: Borelog) => {
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
          const response = await borelogApi.getByProject(selectedProject);
          
          if (response.data && Array.isArray(response.data.data)) {
            setBorelogs(response.data.data);
            setFilteredBorelogs(response.data.data);
          } else if (response.data && Array.isArray(response.data)) {
            setBorelogs(response.data);
            setFilteredBorelogs(response.data);
          }
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
      await borelogApi.update(borelogId, { 
        substructure_id: substructureId === 'none' ? null : substructureId 
      });
      
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
            <h1 className="text-3xl font-bold text-foreground mb-2">Manage Geological Logs</h1>
            <p className="text-muted-foreground">
              View and edit geological log details for your projects
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
            <Button className="bg-gradient-to-r from-primary to-primary-glow hover:shadow-elegant transition-all duration-300" asChild>
              <Link to="/geological-log/create">
                <Plus className="h-4 w-4 mr-2" />
                Create New Geological Log
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
                    placeholder="Search by borehole number, location, chainage..."
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
              />
            </CardContent>
          </Card>
        )}

        {/* Results Summary */}
        {selectedProject !== 'all' && !isLoading && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              Showing {filteredBorelogs.length} of {borelogs.length} geological logs
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
                  Choose a project from the dropdown above to view and manage its geological logs.
                </p>
              </div>
            ) : isLoading ? (
              <div className="p-8 text-center">
                <Loader size="lg" text="Loading geological logs..." />
              </div>
            ) : filteredBorelogs.length === 0 ? (
              <div className="p-8 text-center">
                <Drill className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No geological logs found</h3>
                <p className="text-muted-foreground mb-4">
                  {borelogs.length === 0 
                    ? 'This project has no geological logs yet.'
                    : 'No geological logs match your search criteria.'
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
                    <Link to="/geological-log/create">
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Geological Log
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Borehole Number</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Depth (m)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Substructure</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBorelogs.map((borelog) => (
                      <TableRow key={borelog.borelog_id}>
                        <TableCell className="font-medium">{borelog.borehole_number}</TableCell>
                        <TableCell>
                          <div className="flex items-start gap-1.5">
                            <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <span>{borelog.borehole_location}</span>
                          </div>
                          {borelog.chainage_km && (
                            <span className="text-xs text-muted-foreground block mt-1">
                              Chainage: {borelog.chainage_km} km
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{borelog.termination_depth} m</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Completed
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isLoadingSubstructures ? (
                            <Loader size="sm" />
                          ) : (
                            <Select
                              value={borelog.substructure_id || 'none'}
                              onValueChange={(value) => handleQuickAssign(borelog.borelog_id, value === 'none' ? '' : value)}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Not assigned" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Not assigned</SelectItem>
                                {substructures.map((sub) => (
                                  <SelectItem key={sub.id} value={sub.id}>
                                    {sub.name} ({sub.type})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <Link to={`/geological-log/${borelog.borelog_id}`}>
                                View
                              </Link>
                            </Button>
                            <BorelogEditModal
                              borelog={borelog}
                              substructures={substructures}
                              onUpdate={handleBorelogUpdate}
                            />
                            {(user?.role === 'Admin' || user?.role === 'Project Manager' || user?.role === 'Site Engineer') && (
                              <DeleteBorelogButton 
                                borelogId={borelog.borelog_id} 
                                onSuccess={() => handleBorelogDelete(borelog.borelog_id)}
                              />
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