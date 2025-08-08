import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { geologicalLogSchema, GeologicalLogFormData } from '@/lib/zodSchemas';
import { geologicalLogApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CoordinateMapPicker } from '@/components/CoordinateMapPicker';
import { BorelogImageManager } from '@/components/BorelogImageManager';

export function CreateBorelogForm() {
  const [createdBorelogId, setCreatedBorelogId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<GeologicalLogFormData>({
    resolver: zodResolver(geologicalLogSchema),
    defaultValues: {
      project_name: '',
      client_name: '',
      design_consultant: '',
      job_code: '',
      project_location: '',
      chainage_km: undefined,
      area: '',
      borehole_location: '',
      borehole_number: '',
      msl: '',
      method_of_boring: '',
      diameter_of_hole: 0,
      commencement_date: '',
      completion_date: '',
      standing_water_level: undefined,
      termination_depth: 0,
      coordinate: undefined,
      type_of_core_barrel: '',
      bearing_of_hole: '',
      collar_elevation: undefined,
      logged_by: '',
      checked_by: '',
      lithology: '',
      rock_methodology: '',
      structural_condition: '',
      weathering_classification: '',
      fracture_frequency_per_m: undefined,
      remarks: '',
      created_by_user_id: null
    }
  });

  const onSubmit = async (data: GeologicalLogFormData) => {
    setIsSubmitting(true);
    try {
      // Create a clean copy of the data without any undefined values
      const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          // Skip coordinate if it's the default [0, 0] or undefined
          if (key === 'coordinate') {
            if (value && value.coordinates && 
                value.coordinates[0] === 0 && value.coordinates[1] === 0) {
              return acc; // Skip this field
            }
          }
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);
      
      // Ensure created_by_user_id is explicitly set to null
      const submissionData = {
        ...cleanData,
        created_by_user_id: null
      };
      
      console.log('Submitting data:', submissionData);
      console.log('Auth token:', localStorage.getItem('auth_token'));
      console.log('API base URL:', import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/dev");
      const response = await geologicalLogApi.create(submissionData);
      
      // Log the full response for debugging
      console.log('API Response:', response);
      console.log('Response data:', response.data);
      console.log('Geological log data:', response.data.data);
      
      // Extract the borelog_id from the response
      const borelogId = response.data.data.borelog_id;
      console.log('Extracted borelog_id:', borelogId);
      
      // Set the created borelog ID to show the image manager
      setCreatedBorelogId(borelogId);
      
      toast({
        title: 'Success',
        description: 'Geological log created successfully. You can now add images.',
      });
      
      // Navigate to the correct URL with the borelog_id
      if (borelogId) {
        console.log('Navigating to:', `/geological-log/${borelogId}`);
        navigate(`/geological-log/${borelogId}`);
      } else {
        console.error('No borelog_id in response:', response);
        toast({
          title: 'Warning',
          description: 'Log created but could not navigate to details page.',
          variant: 'warning',
        });
        // Navigate to the list page instead
        navigate('/geological-log/list');
      }
    } catch (error) {
      console.error('Error creating geological log:', error);
      toast({
        title: 'Error',
        description: 'Failed to create geological log. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCoordinateChange = (coordinate: { type: 'Point'; coordinates: [number, number] }) => {
    console.log('Coordinate changed:', coordinate);
    form.setValue('coordinate', coordinate);
  };

  // Helper function to safely handle number inputs
  const handleNumberInput = (value: string, onChange: (...event: any[]) => void) => {
    if (value === '') {
      onChange(undefined);
    } else {
      const parsedValue = parseFloat(value);
      onChange(isNaN(parsedValue) ? undefined : parsedValue);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Enter Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Project Information */}
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Project Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="project_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Project Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="client_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Client Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="design_consultant"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Design Consultant</FormLabel>
                      <FormControl>
                        <Input placeholder="Design Consultant" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="job_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Code</FormLabel>
                      <FormControl>
                        <Input placeholder="Job Code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="project_location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Project Location" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="area"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Area</FormLabel>
                      <FormControl>
                        <Input placeholder="Area" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="chainage_km"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chainage (km, optional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="any" 
                          placeholder="Chainage in km" 
                          value={field.value === undefined ? '' : field.value}
                          onChange={(e) => handleNumberInput(e.target.value, field.onChange)} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Borehole Information */}
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Borehole Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="borehole_location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Borehole Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Borehole Location" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="borehole_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Borehole Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Borehole Number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="msl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MSL (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="MSL" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="method_of_boring"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Method of Boring</FormLabel>
                      <FormControl>
                        <Input placeholder="Method of Boring" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="diameter_of_hole"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Diameter of Hole (mm)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="any" 
                          placeholder="Diameter in mm" 
                          value={field.value === undefined || isNaN(field.value) ? '' : field.value}
                          onChange={(e) => handleNumberInput(e.target.value, field.onChange)} 
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
                      <FormLabel>Termination Depth (m)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="any" 
                          placeholder="Depth in meters" 
                          value={field.value === undefined || isNaN(field.value) ? '' : field.value}
                          onChange={(e) => handleNumberInput(e.target.value, field.onChange)} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="standing_water_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Standing Water Level (m, optional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="any" 
                          placeholder="Water level in meters"
                          value={field.value === undefined ? '' : field.value}
                          onChange={(e) => handleNumberInput(e.target.value, field.onChange)} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Coordinates */}
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Coordinates</h3>
              <CoordinateMapPicker
                value={form.watch('coordinate')}
                onChange={handleCoordinateChange}
              />
            </div>

            {/* Dates and Personnel */}
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Dates and Personnel</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="commencement_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commencement Date</FormLabel>
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
                      <FormLabel>Completion Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="logged_by"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logged By</FormLabel>
                      <FormControl>
                        <Input placeholder="Logged By" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="checked_by"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Checked By</FormLabel>
                      <FormControl>
                        <Input placeholder="Checked By" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Additional Technical Information */}
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Additional Technical Information (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type_of_core_barrel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type of Core Barrel</FormLabel>
                      <FormControl>
                        <Input placeholder="Type of Core Barrel" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bearing_of_hole"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bearing of Hole</FormLabel>
                      <FormControl>
                        <Input placeholder="Bearing of Hole" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="collar_elevation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Collar Elevation</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="any" 
                          placeholder="Collar Elevation" 
                          value={field.value === undefined ? '' : field.value}
                          onChange={(e) => handleNumberInput(e.target.value, field.onChange)} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lithology"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lithology</FormLabel>
                      <FormControl>
                        <Input placeholder="Lithology" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rock_methodology"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rock Methodology</FormLabel>
                      <FormControl>
                        <Input placeholder="Rock Methodology" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="structural_condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Structural Condition</FormLabel>
                      <FormControl>
                        <Input placeholder="Structural Condition" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="weathering_classification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weathering Classification</FormLabel>
                      <FormControl>
                        <Input placeholder="Weathering Classification" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fracture_frequency_per_m"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fracture Frequency (per m)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="any" 
                          placeholder="Fracture Frequency" 
                          value={field.value === undefined ? '' : field.value}
                          onChange={(e) => handleNumberInput(e.target.value, field.onChange)} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Remarks */}
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional remarks or notes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Creating...' : 'Create Geological Log'}
            </Button>
          </form>
        </Form>

        {/* Show image manager after borelog is created */}
        {createdBorelogId && (
          <div className="mt-8">
            <h3 className="text-lg font-medium mb-4">Add Images</h3>
            <BorelogImageManager
              borelogId={createdBorelogId}
              onImagesChange={() => {
                // Optionally handle image changes
                toast({
                  title: 'Success',
                  description: 'Images updated successfully',
                });
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
} 