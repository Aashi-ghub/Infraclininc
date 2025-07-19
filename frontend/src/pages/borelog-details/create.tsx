import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { borelogDetailsApi, geologicalLogApi } from '@/lib/api';
import { borelogDetailSchema, type BorelogDetailFormData } from '@/lib/zodSchemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader } from '@/components/Loader';
import { useEffect } from 'react';
import { GeologicalLog } from '@/lib/types';
import { CoordinateMapPicker } from '@/components/CoordinateMapPicker';

export default function CreateBorelogDetailPage() {
  const [searchParams] = useSearchParams();
  const borelog_id = searchParams.get('borelog_id');
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [geologicalLog, setGeologicalLog] = useState<GeologicalLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const form = useForm<BorelogDetailFormData>({
    resolver: zodResolver(borelogDetailSchema),
    defaultValues: {
      borelog_id: borelog_id || '',
      number: '',
      msl: '',
      boring_method: '',
      hole_diameter: 0,
      commencement_date: '',
      completion_date: '',
      standing_water_level: undefined,
      termination_depth: 0,
      coordinate: {
        type: 'Point',
        coordinates: [0, 0]
      },
      stratum_description: '',
      stratum_depth_from: 0,
      stratum_depth_to: 0,
      stratum_thickness_m: 0,
      remarks: '',
    },
  });

  // Auto-calculate thickness when depth_from or depth_to changes
  const watchDepthFrom = form.watch('stratum_depth_from');
  const watchDepthTo = form.watch('stratum_depth_to');

  useEffect(() => {
    if (watchDepthFrom !== undefined && watchDepthTo !== undefined) {
      const thickness = watchDepthTo - watchDepthFrom;
      if (thickness >= 0) {
        form.setValue('stratum_thickness_m', thickness);
      }
    }
  }, [watchDepthFrom, watchDepthTo, form]);

  useEffect(() => {
    const fetchGeologicalLog = async () => {
      if (!borelog_id) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await geologicalLogApi.getById(borelog_id);
        setGeologicalLog(response.data.data);
        
        // Pre-fill some fields from the geological log
        if (response.data.data) {
          const log = response.data.data;
          form.setValue('boring_method', log.method_of_boring);
          
          // Safely handle numeric values
          const diameter = typeof log.diameter_of_hole === 'string' 
            ? parseFloat(log.diameter_of_hole) 
            : log.diameter_of_hole;
          form.setValue('hole_diameter', isNaN(diameter) ? 0 : diameter);
          
          form.setValue('commencement_date', log.commencement_date.split('T')[0]);
          form.setValue('completion_date', log.completion_date.split('T')[0]);
          
          // Safely handle standing water level
          const waterLevel = typeof log.standing_water_level === 'string' 
            ? parseFloat(log.standing_water_level) 
            : log.standing_water_level;
          form.setValue('standing_water_level', isNaN(waterLevel) ? undefined : waterLevel);
          
          // Safely handle termination depth
          const termDepth = typeof log.termination_depth === 'string' 
            ? parseFloat(log.termination_depth) 
            : log.termination_depth;
          form.setValue('termination_depth', isNaN(termDepth) ? 0 : termDepth);
          
          if (log.coordinate) {
            form.setValue('coordinate', log.coordinate);
          }
          if (log.msl) {
            form.setValue('msl', log.msl);
          }
        }
      } catch (error) {
        console.error('Error fetching geological log:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch geological log details.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchGeologicalLog();
  }, [borelog_id, toast, form]);

  const onSubmit = async (data: BorelogDetailFormData) => {
    if (!borelog_id) {
      toast({
        title: 'Error',
        description: 'Borelog ID is required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await borelogDetailsApi.create(data);
      toast({
        title: 'Success',
        description: 'Borelog detail created successfully.',
      });
      navigate(`/geological-log/${borelog_id}`);
    } catch (error) {
      console.error('Error creating borelog detail:', error);
      toast({
        title: 'Error',
        description: 'Failed to create borelog detail. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add this function to fill the form with sample data
  const fillWithSampleData = () => {
    // Sample data for different strata
    const sampleStrata = [
      {
        number: "BH001-S1",
        boring_method: "Rotary Drilling",
        hole_diameter: 150,
        commencement_date: "2025-07-15",
        completion_date: "2025-07-16",
        standing_water_level: 12.5,
        termination_depth: 30.5,
        msl: "45.2m",
        stratum_depth_from: 0.0,
        stratum_depth_to: 3.5,
        stratum_description: "Loose to medium dense, dark brown, silty SAND with occasional gravel. Moist.",
        remarks: "Topsoil layer with organic content."
      },
      {
        number: "BH001-S2",
        boring_method: "Rotary Drilling",
        hole_diameter: 150,
        commencement_date: "2025-07-15",
        completion_date: "2025-07-16",
        standing_water_level: 12.5,
        termination_depth: 30.5,
        msl: "45.2m",
        stratum_depth_from: 3.5,
        stratum_depth_to: 8.2,
        stratum_description: "Medium stiff to stiff, reddish-brown, sandy CLAY with occasional gravel. Medium plasticity.",
        remarks: "Slight moisture content increase with depth."
      },
      {
        number: "BH001-S3",
        boring_method: "Rotary Drilling",
        hole_diameter: 150,
        commencement_date: "2025-07-15",
        completion_date: "2025-07-16",
        standing_water_level: 12.5,
        termination_depth: 30.5,
        msl: "45.2m",
        stratum_depth_from: 8.2,
        stratum_depth_to: 15.7,
        stratum_description: "Dense to very dense, gray, silty SAND with gravel. Water bearing.",
        remarks: "Water seepage observed at 12.5m depth."
      },
      {
        number: "BH001-S4",
        boring_method: "Rotary Drilling",
        hole_diameter: 150,
        commencement_date: "2025-07-15",
        completion_date: "2025-07-16",
        standing_water_level: 12.5,
        termination_depth: 30.5,
        msl: "45.2m",
        stratum_depth_from: 15.7,
        stratum_depth_to: 22.3,
        stratum_description: "Moderately weathered, gray to light brown, SANDSTONE. Medium strength.",
        remarks: "Core recovery: 85%, RQD: 70%"
      },
      {
        number: "BH001-S5",
        boring_method: "Rotary Drilling",
        hole_diameter: 150,
        commencement_date: "2025-07-15",
        completion_date: "2025-07-16",
        standing_water_level: 12.5,
        termination_depth: 30.5,
        msl: "45.2m",
        stratum_depth_from: 22.3,
        stratum_depth_to: 30.5,
        stratum_description: "Slightly weathered to fresh, gray, LIMESTONE. High strength with occasional fractures.",
        remarks: "Core recovery: 95%, RQD: 90%"
      }
    ];
    
    // Select a random sample
    const sample = sampleStrata[Math.floor(Math.random() * sampleStrata.length)];
    
    // Fill form fields
    Object.entries(sample).forEach(([key, value]) => {
      if (key in form.getValues()) {
        form.setValue(key as any, value);
      }
    });
    
    // If there's a coordinate in the geological log, use it
    if (geologicalLog?.coordinate) {
      form.setValue('coordinate', geologicalLog.coordinate);
    }
    
    toast({
      title: 'Sample Data',
      description: 'Form filled with sample geological data.',
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader size="lg" />
      </div>
    );
  }

  if (!borelog_id) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Missing Borelog ID</h1>
        <p className="mb-4">A borelog ID is required to create a detail.</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  if (!geologicalLog) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Geological Log Not Found</h1>
        <p className="mb-4">The geological log you're trying to add details to doesn't exist or has been removed.</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Add Borelog Detail</h1>
          <p className="text-muted-foreground">
            For Borehole: {geologicalLog.borehole_number} | Project: {geologicalLog.project_name}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Detail Information</span>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={fillWithSampleData}
              >
                Fill with Sample Data
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter detail number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="boring_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Boring Method *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Rotary Drilling" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hole_diameter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hole Diameter (mm) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="1" 
                            placeholder="Enter hole diameter" 
                            value={isNaN(field.value) ? '' : field.value}
                            onChange={(e) => {
                              const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                              field.onChange(isNaN(value) ? 0 : value);
                            }} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="commencement_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Commencement Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="completion_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Completion Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="standing_water_level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Standing Water Level (m)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="Enter water level" 
                            value={field.value === undefined || isNaN(field.value) ? '' : field.value}
                            onChange={(e) => {
                              const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                              field.onChange(isNaN(value) ? undefined : value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="termination_depth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Termination Depth (m) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="Enter termination depth" 
                            value={isNaN(field.value) ? '' : field.value}
                            onChange={(e) => {
                              const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                              field.onChange(isNaN(value) ? 0 : value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="msl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MSL (Mean Sea Level)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 45.2m" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="coordinate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location Coordinates</FormLabel>
                      <FormControl>
                        <CoordinateMapPicker
                          value={field.value}
                          onChange={(coordinates) => field.onChange(coordinates)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="stratum_depth_from"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Depth From (m) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="Enter depth from" 
                            value={isNaN(field.value) ? '' : field.value}
                            onChange={(e) => {
                              const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                              field.onChange(isNaN(value) ? 0 : value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stratum_depth_to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Depth To (m) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="Enter depth to" 
                            value={isNaN(field.value) ? '' : field.value}
                            onChange={(e) => {
                              const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                              field.onChange(isNaN(value) ? 0 : value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stratum_thickness_m"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Thickness (m) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="Auto-calculated" 
                            value={isNaN(field.value) ? '' : field.value}
                            readOnly
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="stratum_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stratum Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Detailed description of the stratum" 
                          className="min-h-[100px]"
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
                      <FormLabel>Remarks</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any additional observations or notes" 
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => navigate(`/geological-log/${borelog_id}`)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader size="sm" className="mr-2" /> : null}
                    {isSubmitting ? 'Creating...' : 'Create Detail'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 