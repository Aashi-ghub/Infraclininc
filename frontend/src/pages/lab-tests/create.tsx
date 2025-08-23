import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Search, Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ProtectedRoute } from '@/lib/authComponents';
import { labTestSchema, LabTestFormData } from '@/lib/zodSchemas';
import { apiClient } from '@/lib/api';
import { geologicalLogApi, userApi, workflowApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Borelog {
  borelog_id: string;
  borehole_number: string;
  project_name: string;
  client_name: string;
  status?: string;
}

interface LabEngineer {
  user_id: string;
  name: string;
  email: string;
}

interface AssignmentFormData {
  borelog_id: string;
  sample_ids: string[];
  test_types: string[];
  assigned_lab_engineer: string;
  priority: string;
  expected_completion_date: string;
  notes: string;
}

const testTypes = [
  'Compressive Strength',
  'Tensile Strength',
  'Density Test',
  'Moisture Content',
  'Permeability Test',
  'Triaxial Test',
  'Direct Shear Test',
  'Consolidation Test',
  'Atterberg Limits',
  'Particle Size Distribution'
];

export default function CreateLabTest() {
  const [borelogs, setBorelogs] = useState<Borelog[]>([]);
  const [approvedBorelogs, setApprovedBorelogs] = useState<Borelog[]>([]);
  const [labEngineers, setLabEngineers] = useState<LabEngineer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBorelogs, setIsLoadingBorelogs] = useState(false);
  const [isLoadingEngineers, setIsLoadingEngineers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
  const [selectedTestTypes, setSelectedTestTypes] = useState<string[]>([]);
  const [newSampleId, setNewSampleId] = useState('');
  const [newTestType, setNewTestType] = useState('');
  const [activeTab, setActiveTab] = useState('create');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<LabTestFormData>({
    resolver: zodResolver(labTestSchema),
    defaultValues: {
      result: '',
      tested_by: '',
      remarks: '',
    },
  });

  useEffect(() => {
    fetchBorelogs();
    if (user?.role === 'Admin' || user?.role === 'Project Manager') {
      fetchApprovedBorelogs();
      fetchLabEngineers();
    }
  }, [user]);

  const fetchBorelogs = async () => {
    setIsLoadingBorelogs(true);
    try {
      const response = await geologicalLogApi.list();
      if (response.data?.success) {
        setBorelogs(response.data.data || []);
      } else {
        console.error('Failed to load borelogs:', response.data?.message);
        setBorelogs([]);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to fetch borelogs',
        });
      }
    } catch (error) {
      console.error('Error fetching borelogs:', error);
      setBorelogs([]);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch borelogs',
      });
    } finally {
      setIsLoadingBorelogs(false);
    }
  };

  const fetchApprovedBorelogs = async () => {
    try {
      const response = await geologicalLogApi.list();
      if (response.data?.success) {
        const allBorelogs = response.data.data || [];
        const approved = allBorelogs.filter((borelog: Borelog) => borelog.status === 'approved');
        setApprovedBorelogs(approved);
      }
    } catch (error) {
      console.error('Error fetching approved borelogs:', error);
      setApprovedBorelogs([]);
    }
  };

  const fetchLabEngineers = async () => {
    setIsLoadingEngineers(true);
    try {
      const response = await userApi.list();
      if (response.data?.success) {
        const allUsers = response.data.data || [];
        const engineers = allUsers.filter((user: any) => user.role === 'Lab Engineer');
        setLabEngineers(engineers);
      }
    } catch (error) {
      console.error('Error fetching lab engineers:', error);
      setLabEngineers([]);
    } finally {
      setIsLoadingEngineers(false);
    }
  };

  const onSubmit = async (data: LabTestFormData) => {
    setIsLoading(true);
    try {
      await apiClient.post('/lab-tests', data);
      toast({
        title: 'Success',
        description: 'Lab test created successfully',
      });
      navigate('/lab-tests/list');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create lab test',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitAssignment = async (data: AssignmentFormData) => {
    if (selectedSamples.length === 0 || selectedTestTypes.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please add at least one sample and test type',
      });
      return;
    }

    setIsLoading(true);
    try {
      await workflowApi.assignLabTests({
        borelog_id: data.borelog_id,
        sample_ids: selectedSamples,
        test_types: selectedTestTypes,
        assigned_lab_engineer: data.assigned_lab_engineer,
        priority: data.priority,
        expected_completion_date: data.expected_completion_date,
        notes: data.notes
      });

      toast({
        title: 'Success',
        description: 'Lab tests assigned successfully',
      });
      navigate('/workflow/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Failed to assign lab tests',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addSample = () => {
    if (newSampleId.trim() && !selectedSamples.includes(newSampleId.trim())) {
      setSelectedSamples([...selectedSamples, newSampleId.trim()]);
      setNewSampleId('');
    }
  };

  const removeSample = (sampleId: string) => {
    setSelectedSamples(selectedSamples.filter(id => id !== sampleId));
  };

  const addTestType = () => {
    if (newTestType && !selectedTestTypes.includes(newTestType)) {
      setSelectedTestTypes([...selectedTestTypes, newTestType]);
      setNewTestType('');
    }
  };

  const removeTestType = (testType: string) => {
    setSelectedTestTypes(selectedTestTypes.filter(type => type !== testType));
  };

  const filteredBorelogs = approvedBorelogs.filter(borelog =>
    borelog.borehole_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    borelog.project_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ProtectedRoute allowedRoles={['Admin', 'Lab Engineer', 'Project Manager']}>
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate('/lab-tests/list')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Lab Test Management</h1>
            <p className="text-gray-600 mt-2">Create lab tests or assign tests to lab engineers</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-4xl mx-auto">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Create Lab Test</TabsTrigger>
            {(user?.role === 'Admin' || user?.role === 'Project Manager') && (
              <TabsTrigger value="assign">Assign Lab Tests</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="create" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create Lab Test</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="borelog_id">Borelog *</Label>
                    <Select 
                      value={form.watch('borelog_id')} 
                      onValueChange={(value) => form.setValue('borelog_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a borelog" />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingBorelogs ? (
                          <SelectItem value="loading" disabled>Loading borelogs...</SelectItem>
                        ) : borelogs.length === 0 ? (
                          <SelectItem value="none" disabled>No borelogs found</SelectItem>
                        ) : (
                          borelogs.map((borelog) => (
                            <SelectItem key={borelog.borelog_id} value={borelog.borelog_id}>
                              {borelog.borehole_number} - {borelog.project_name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.borelog_id && (
                      <p className="text-sm text-red-600">{form.formState.errors.borelog_id.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="test_type">Test Type *</Label>
                    <Select 
                      value={form.watch('test_type')} 
                      onValueChange={(value) => form.setValue('test_type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select test type" />
                      </SelectTrigger>
                      <SelectContent>
                        {testTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.test_type && (
                      <p className="text-sm text-red-600">{form.formState.errors.test_type.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="result">Test Result *</Label>
                    <Textarea
                      id="result"
                      placeholder="Enter test results..."
                      {...form.register('result')}
                      rows={4}
                    />
                    {form.formState.errors.result && (
                      <p className="text-sm text-red-600">{form.formState.errors.result.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tested_by">Tested By *</Label>
                    <Input
                      id="tested_by"
                      placeholder="Enter tester name"
                      {...form.register('tested_by')}
                    />
                    {form.formState.errors.tested_by && (
                      <p className="text-sm text-red-600">{form.formState.errors.tested_by.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="remarks">Remarks</Label>
                    <Textarea
                      id="remarks"
                      placeholder="Additional remarks or notes..."
                      {...form.register('remarks')}
                      rows={3}
                    />
                    {form.formState.errors.remarks && (
                      <p className="text-sm text-red-600">{form.formState.errors.remarks.message}</p>
                    )}
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => navigate('/lab-tests/list')}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Creating...' : 'Create Test'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {(user?.role === 'Admin' || user?.role === 'Project Manager') && (
            <TabsContent value="assign" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Assign Lab Tests</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Assign lab tests to approved borelogs for lab engineers to perform
                  </p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    onSubmitAssignment({
                      borelog_id: formData.get('borelog_id') as string,
                      sample_ids: selectedSamples,
                      test_types: selectedTestTypes,
                      assigned_lab_engineer: formData.get('assigned_lab_engineer') as string,
                      priority: formData.get('priority') as string,
                      expected_completion_date: formData.get('expected_completion_date') as string,
                      notes: formData.get('notes') as string
                    });
                  }} className="space-y-6">
                    
                    {/* Borelog Selection with Search */}
                    <div className="space-y-2">
                      <Label htmlFor="borelog_search">Search Approved Borelogs</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="borelog_search"
                          placeholder="Search by borehole number or project name..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Select Borelog *</Label>
                      <Select name="borelog_id" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an approved borelog" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredBorelogs.length === 0 ? (
                            <SelectItem value="none" disabled>
                              {searchTerm ? 'No borelogs found matching search' : 'No approved borelogs available'}
                            </SelectItem>
                          ) : (
                            filteredBorelogs.map((borelog) => (
                              <SelectItem key={borelog.borelog_id} value={borelog.borelog_id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{borelog.borehole_number}</span>
                                  <span className="text-sm text-muted-foreground">{borelog.project_name}</span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Sample IDs */}
                    <div className="space-y-2">
                      <Label>Sample IDs *</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter sample ID"
                          value={newSampleId}
                          onChange={(e) => setNewSampleId(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSample())}
                        />
                        <Button type="button" onClick={addSample} size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {selectedSamples.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selectedSamples.map((sampleId) => (
                            <Badge key={sampleId} variant="secondary" className="flex items-center gap-1">
                              {sampleId}
                              <X 
                                className="h-3 w-3 cursor-pointer" 
                                onClick={() => removeSample(sampleId)}
                              />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Test Types */}
                    <div className="space-y-2">
                      <Label>Test Types *</Label>
                      <div className="flex gap-2">
                        <Select value={newTestType} onValueChange={setNewTestType}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select test type" />
                          </SelectTrigger>
                          <SelectContent>
                            {testTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" onClick={addTestType} size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {selectedTestTypes.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selectedTestTypes.map((testType) => (
                            <Badge key={testType} variant="secondary" className="flex items-center gap-1">
                              {testType}
                              <X 
                                className="h-3 w-3 cursor-pointer" 
                                onClick={() => removeTestType(testType)}
                              />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Lab Engineer Assignment */}
                    <div className="space-y-2">
                      <Label htmlFor="assigned_lab_engineer">Assign to Lab Engineer *</Label>
                      <Select name="assigned_lab_engineer" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select lab engineer" />
                        </SelectTrigger>
                        <SelectContent>
                          {isLoadingEngineers ? (
                            <SelectItem value="loading" disabled>Loading engineers...</SelectItem>
                          ) : labEngineers.length === 0 ? (
                            <SelectItem value="none" disabled>No lab engineers found</SelectItem>
                          ) : (
                            labEngineers.map((engineer) => (
                              <SelectItem key={engineer.user_id} value={engineer.user_id}>
                                {engineer.name} ({engineer.email})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Priority */}
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority *</Label>
                      <Select name="priority" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Due Date */}
                    <div className="space-y-2">
                      <Label htmlFor="expected_completion_date">Expected Completion Date *</Label>
                      <Input
                        type="date"
                        name="expected_completion_date"
                        required
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        name="notes"
                        placeholder="Additional notes or instructions for the lab engineer..."
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => navigate('/lab-tests/list')}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? 'Assigning...' : 'Assign Lab Tests'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </ProtectedRoute>
  );
}