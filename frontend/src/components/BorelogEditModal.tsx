import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { geologicalLogSchema, GeologicalLogFormData } from '@/lib/zodSchemas';
import { geologicalLogApi } from '@/lib/api';
import { GeologicalLog } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

// Export types needed by other components
export type Borelog = GeologicalLog & {
  substructure_id?: string;
  borehole_number?: string;
  chainage?: string;
};

export type Substructure = {
  id: string;
  name: string;
  type: string;
};

interface BorelogEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  geologicalLog: GeologicalLog;
  onUpdate: (updatedLog: GeologicalLog) => void;
}

export function BorelogEditModal({ isOpen, onClose, geologicalLog, onUpdate }: BorelogEditModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<GeologicalLogFormData>({
    resolver: zodResolver(geologicalLogSchema),
    defaultValues: {
      project_id: geologicalLog.project_id,
      project_name: geologicalLog.project_name,
      borehole_id: geologicalLog.borehole_id,
      location: geologicalLog.location,
      latitude: geologicalLog.latitude,
      longitude: geologicalLog.longitude,
      elevation: geologicalLog.elevation,
      total_depth: geologicalLog.total_depth,
      start_date: geologicalLog.start_date,
      end_date: geologicalLog.end_date,
      logged_by: geologicalLog.logged_by,
      drilling_method: geologicalLog.drilling_method,
      water_level: geologicalLog.water_level,
      remarks: geologicalLog.remarks || '',
    }
  });

  const onSubmit = async (data: GeologicalLogFormData) => {
    setIsSubmitting(true);
    try {
      const response = await geologicalLogApi.update(geologicalLog.id, data);
      toast({
        title: 'Success',
        description: 'Geological log updated successfully',
      });
      onUpdate(response.data.data);
      onClose();
    } catch (error) {
      console.error('Error updating geological log:', error);
      toast({
        title: 'Error',
        description: 'Failed to update geological log. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Geological Log</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="project_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Project ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                name="borehole_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Borehole ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Borehole ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Location" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="elevation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Elevation (m)</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="total_depth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Depth (m)</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="water_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Water Level (m, optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="any" 
                        {...field} 
                        value={field.value === undefined ? '' : field.value}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
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
                name="drilling_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Drilling Method</FormLabel>
                    <FormControl>
                      <Input placeholder="Drilling Method" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Geological Log'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}