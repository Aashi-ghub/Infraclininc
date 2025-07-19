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
import { Link } from 'react-router-dom';

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
    { id: 'Highway Expansion Project', name: 'Highway Expansion Project' },
    { id: 'Metro Rail Construction', name: 'Metro Rail Construction' },
    { id: 'Bridge Foundation Survey', name: 'Bridge Foundation Survey' },
    { id: 'Test Project', name: 'Test Project' },
    { id: 'Delhi Metro Phase 4', name: 'Delhi Metro Phase 4' },
    { id: 'Direct Test Project', name: 'Direct Test Project' }
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
        console.log('Loading borelogs for project:', selectedProject);
        const response = await borelogApi.getByProject(selectedProject);
        console.log('Borelogs response:', response);
        
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
            <h1 className="text-3xl font-bold text-foreground mb-2">Manage Borelogs</h1>
            <p className="text-muted-foreground">
              View and edit borelog details for your projects
            </p>
          </div>
          <Button className="bg-gradient-to-r from-primary to-primary-glow hover:shadow-elegant transition-all duration-300" asChild>
            <Link to="/geological-log/create">
              <Plus className="h-4 w-4 mr-2" />
              Create New Borelog
            </Link>
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
                <Button className="bg-gradient-to-r from-primary to-primary-glow" asChild>
                  <Link to="/geological-log/create">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Borelog
                  </Link>
                </Button>
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