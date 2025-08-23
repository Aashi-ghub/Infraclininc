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
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ProtectedRoute } from '@/lib/authComponents';
import { labTestSchema, LabTestFormData } from '@/lib/zodSchemas';
import { apiClient } from '@/lib/api';
import { geologicalLogApi } from '@/lib/api';

interface Borelog {
  borelog_id: string;
  borehole_number: string;
  project_name: string;
  client_name: string;
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
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBorelogs, setIsLoadingBorelogs] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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
  }, []);

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

  return (
    <ProtectedRoute allowedRoles={['Admin', 'Lab Engineer']}>
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate('/lab-tests/list')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Lab Test</h1>
            <p className="text-gray-600 mt-2">Create a new laboratory test record</p>
          </div>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Lab Test Information</CardTitle>
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
                      <SelectItem value="" disabled>Loading borelogs...</SelectItem>
                    ) : borelogs.length === 0 ? (
                      <SelectItem value="" disabled>No borelogs found</SelectItem>
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
      </div>
    </ProtectedRoute>
  );
}