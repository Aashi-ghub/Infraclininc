import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, TestTube } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { ProtectedRoute } from '@/lib/authComponents';

const labTestSchema = z.object({
  borelog_id: z.string().uuid('Please select a borelog'),
  test_type: z.string().min(1, 'Test type is required'),
  result: z.string().min(1, 'Test result is required'),
  tested_by: z.string().min(1, 'Tested by is required'),
  test_date: z.date({ required_error: 'Test date is required' }),
  remarks: z.string().optional(),
});

type LabTestFormData = z.infer<typeof labTestSchema>;

interface Borelog {
  borelog_id: string;
  borehole_number: string;
  project_name: string;
  chainage_km?: number;
  borehole_location: string;
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
    try {
      const response = await apiClient.get('/geological-log');
      // Extract the data array from the response
      if (response.data && response.data.data) {
        setBorelogs(response.data.data);
      } else {
        // Fallback to empty array if data structure is unexpected
        setBorelogs([]);
        console.error('Unexpected API response format:', response);
      }
    } catch (error) {
      console.error('Error fetching borelogs:', error);
      setBorelogs([]); // Set to empty array on error
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch borelogs',
      });
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
    <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Technician']}>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TestTube className="h-8 w-8 text-primary" />
            Create Lab Test
          </h1>
          <p className="text-muted-foreground">Add new laboratory test results for borelog samples</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lab Test Details</CardTitle>
            <CardDescription>Enter the test parameters and results</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="borelog_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Borelog</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select borelog" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {borelogs.map((borelog) => (
                              <SelectItem key={borelog.borelog_id} value={borelog.borelog_id}>
                                {borelog.borehole_number} - {borelog.project_name}
                                {borelog.chainage_km && ` (CH: ${borelog.chainage_km} km)`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="test_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Test Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select test type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {testTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tested_by"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tested By</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter technician name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="test_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Test Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick test date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date > new Date()}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="result"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Test Results</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter detailed test results, measurements, and observations..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remarks (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes or observations..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Creating...' : 'Create Lab Test'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/lab-tests/list')}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}