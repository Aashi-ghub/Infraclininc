import { useState, useEffect } from 'react';
import { Search, Plus, Building, MapPin, Drill } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { borelogApi } from '@/lib/api';
import { BorelogEditModal, type Borelog, type Substructure } from '@/components/BorelogEditModal';
import { Loader } from '@/components/Loader';

export default function ManageBorelogs() {
  const { toast } = useToast();
  const [borelogs, setBorelogs] = useState<Borelog[]>([]);
  const [filteredBorelogs, setFilteredBorelogs] = useState<Borelog[]>([]);
  const [substructures, setSubstructures] = useState<Substructure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSubstructures, setIsLoadingSubstructures] = useState(true);
  
  // Filter states
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');

  // Mock projects for demo (in real app, fetch from API)
  const projects = [
    { id: 'proj-1', name: 'Highway Extension Project' },
    { id: 'proj-2', name: 'Metro Rail Construction' },
    { id: 'proj-3', name: 'Bridge Foundation Survey' },
  ];

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
        const response = await borelogApi.getByProject(selectedProject);
        setBorelogs(response.data);
        setFilteredBorelogs(response.data);
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
        borelog.borehole_number.toLowerCase().includes(searchFilter.toLowerCase()) ||
        borelog.location.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (borelog.chainage && borelog.chainage.toLowerCase().includes(searchFilter.toLowerCase()))
      );
    }

    setFilteredBorelogs(filtered);
  }, [borelogs, searchFilter]);

  const handleBorelogUpdate = (updatedBorelog: Borelog) => {
    setBorelogs(prevBorelogs =>
      prevBorelogs.map(borelog =>
        borelog.id === updatedBorelog.id ? updatedBorelog : borelog
      )
    );
  };

  const getSubstructureName = (substructureId?: string) => {
    if (!substructureId) return 'Not assigned';
    const substructure = substructures.find(s => s.id === substructureId);
    return substructure ? `${substructure.name} (${substructure.type})` : 'Unknown';
  };

  const handleQuickAssign = async (borelogId: string, substructureId: string) => {
    try {
      await borelogApi.update(borelogId, { substructure_id: substructureId });
      
      setBorelogs(prevBorelogs =>
        prevBorelogs.map(borelog =>
          borelog.id === borelogId 
            ? { ...borelog, substructure_id: substructureId }
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
              View and edit borelog details for your projects
            </p>
          </div>
          <Button className="bg-gradient-to-r from-primary to-primary-glow hover:shadow-elegant transition-all duration-300">
            <Plus className="h-4 w-4 mr-2" />
            Create New Borelog
          </Button>
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
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Select a project...</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
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
                <Button className="bg-gradient-to-r from-primary to-primary-glow">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Borelog
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Borehole Number</TableHead>
                      <TableHead>Chainage</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Diameter (mm)</TableHead>
                      <TableHead>Depth (m)</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>MSL (m)</TableHead>
                      <TableHead>Assignment</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBorelogs.map((borelog) => (
                      <TableRow key={borelog.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <Badge variant="outline">{borelog.borehole_number}</Badge>
                        </TableCell>
                        <TableCell>{borelog.chainage || 'N/A'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {borelog.location}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {borelog.hole_diameter}mm
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {borelog.termination_depth}m
                        </TableCell>
                        <TableCell>{borelog.method_of_boring}</TableCell>
                        <TableCell className="text-right font-mono">
                          {borelog.msl}m
                        </TableCell>
                        <TableCell>
                          <Select
                            value={borelog.substructure_id || ''}
                            onValueChange={(value) => handleQuickAssign(borelog.id, value)}
                            disabled={isLoadingSubstructures}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Assign..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Not assigned</SelectItem>
                              {substructures.map((substructure) => (
                                <SelectItem key={substructure.id} value={substructure.id}>
                                  {substructure.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          <BorelogEditModal
                            borelog={borelog}
                            substructures={substructures}
                            onUpdate={handleBorelogUpdate}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        {selectedProject !== 'all' && !isLoading && borelogs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <Card className="shadow-form">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{borelogs.length}</div>
                  <div className="text-sm text-muted-foreground">Total Borelogs</div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-form">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {Math.round(borelogs.reduce((sum, log) => sum + log.termination_depth, 0))}m
                  </div>
                  <div className="text-sm text-muted-foreground">Total Depth</div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-form">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {borelogs.filter(b => b.substructure_id).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Assigned</div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-form">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {Math.round(borelogs.reduce((sum, log) => sum + log.hole_diameter, 0) / borelogs.length)}mm
                  </div>
                  <div className="text-sm text-muted-foreground">Avg Diameter</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}