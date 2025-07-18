import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TestTube, Plus, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { ProtectedRoute } from '@/lib/authComponents';

interface LabTest {
  id: string;
  test_type: string;
  result: string;
  tested_by: string;
  test_date: string;
  remarks?: string;
  borelog: {
    borehole_number: string;
    project_name: string;
    chainage?: string;
  };
}

interface Project {
  id: string;
  name: string;
}

export default function LabTestsList() {
  const [labTests, setLabTests] = useState<LabTest[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [testsResponse, projectsResponse] = await Promise.all([
        apiClient.get('/lab-tests'),
        apiClient.get('/projects'),
      ]);
      setLabTests(testsResponse.data);
      setProjects(projectsResponse.data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch lab tests',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTests = labTests.filter((test) => {
    const matchesSearch = 
      test.test_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.tested_by.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.borelog.borehole_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesProject = !selectedProject || 
      test.borelog.project_name.toLowerCase().includes(selectedProject.toLowerCase());
    
    return matchesSearch && matchesProject;
  });

  const getTestTypeBadgeVariant = (testType: string) => {
    const strengthTests = ['Compressive Strength', 'Tensile Strength'];
    const soilTests = ['Density Test', 'Moisture Content', 'Atterberg Limits'];
    const permeabilityTests = ['Permeability Test', 'Consolidation Test'];
    
    if (strengthTests.some(t => testType.includes(t))) return 'destructive';
    if (soilTests.some(t => testType.includes(t))) return 'secondary';
    if (permeabilityTests.some(t => testType.includes(t))) return 'outline';
    return 'default';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <TestTube className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground">Loading lab tests...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TestTube className="h-8 w-8 text-primary" />
              Lab Tests
            </h1>
            <p className="text-muted-foreground">Manage laboratory test results for all projects</p>
          </div>
          <Link to="/lab-tests/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Lab Test
            </Button>
          </Link>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by test type, technician, or borehole..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Filter by project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.name}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Results ({filteredTests.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredTests.length === 0 ? (
              <div className="text-center py-12">
                <TestTube className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No lab tests found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || selectedProject 
                    ? 'Try adjusting your filters' 
                    : 'Get started by creating your first lab test'
                  }
                </p>
                <Link to="/lab-tests/create">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Lab Test
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Test Type</TableHead>
                      <TableHead>Borehole</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Tested By</TableHead>
                      <TableHead>Test Date</TableHead>
                      <TableHead>Result Summary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTests.map((test) => (
                      <TableRow key={test.id}>
                        <TableCell>
                          <Badge variant={getTestTypeBadgeVariant(test.test_type)}>
                            {test.test_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {test.borelog.borehole_number}
                          {test.borelog.chainage && (
                            <div className="text-xs text-muted-foreground">
                              CH: {test.borelog.chainage}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{test.borelog.project_name}</TableCell>
                        <TableCell>{test.tested_by}</TableCell>
                        <TableCell>
                          {format(new Date(test.test_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px] truncate" title={test.result}>
                            {test.result}
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
    </ProtectedRoute>
  );
}