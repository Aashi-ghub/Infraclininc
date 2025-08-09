import { useState } from 'react';
import { Edit, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { GeologicalLog } from '@/lib/types';
import { borelogApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Export types needed by other components
export type Borelog = GeologicalLog;

export type Substructure = {
  id: string;
  name: string;
  type: string;
};

interface BorelogEditModalProps {
  borelog: Borelog;
  substructures?: Substructure[];
  onUpdate: (updatedBorelog: Borelog) => void;
}

export function BorelogEditModal({ borelog, substructures = [], onUpdate }: BorelogEditModalProps) {
  const [open, setOpen] = useState(false);
  // Function to format date from ISO to YYYY-MM-DD
  const formatDateForInput = (isoDate: string | undefined) => {
    if (!isoDate) return '';
    try {
      const date = new Date(isoDate);
      return date.toISOString().split('T')[0];
    } catch (e) {
      console.error('Invalid date:', isoDate);
      return '';
    }
  };

  const [formData, setFormData] = useState({
    project_name: borelog?.project_name || '',
    client_name: borelog?.client_name || '',
    design_consultant: borelog?.design_consultant || '',
    job_code: borelog?.job_code || '',
    project_location: borelog?.project_location || '',
    chainage_km: borelog?.chainage_km?.toString() || '',
    area: borelog?.area || '',
    borehole_location: borelog?.borehole_location || '',
    borehole_number: borelog?.borehole_number || '',
    msl: borelog?.msl || '',
    method_of_boring: borelog?.method_of_boring || '',
    diameter_of_hole: borelog?.diameter_of_hole?.toString() || '',
    commencement_date: formatDateForInput(borelog?.commencement_date),
    completion_date: formatDateForInput(borelog?.completion_date),
    standing_water_level: borelog?.standing_water_level?.toString() || '',
    termination_depth: borelog?.termination_depth?.toString() || '',
    coordinate_lat: borelog?.coordinate ? borelog.coordinate.coordinates[1].toString() : '',
    coordinate_lng: borelog?.coordinate ? borelog.coordinate.coordinates[0].toString() : '',
    type_of_core_barrel: borelog?.type_of_core_barrel || '',
    bearing_of_hole: borelog?.bearing_of_hole || '',
    collar_elevation: borelog?.collar_elevation || '',
    logged_by: borelog?.logged_by || '',
    checked_by: borelog?.checked_by || '',
    substructure_id: borelog?.substructure_id || 'none'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    if (!borelog) {
      toast({
        title: 'Error',
        description: 'Borelog data is not available',
        variant: 'destructive',
      });
      return;
    }

    // Validate required fields
    const requiredFields = [
      'project_name', 'client_name', 'design_consultant', 'job_code',
      'project_location', 'area', 'borehole_location', 'borehole_number',
      'method_of_boring', 'diameter_of_hole', 'commencement_date',
      'completion_date', 'termination_depth', 'logged_by', 'checked_by'
    ];

    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);
    if (missingFields.length > 0) {
      toast({
        title: 'Validation Error',
        description: `Please fill in all required fields: ${missingFields.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Prepare the update data
      // Function to format date to YYYY-MM-DD
      const formatDateToAPI = (dateStr: string) => {
        if (!dateStr) return undefined;
        try {
          const date = new Date(dateStr);
          return date.toISOString().split('T')[0];
        } catch (e) {
          console.error('Invalid date:', dateStr);
          return undefined;
        }
      };

      const updateData = {
        ...formData,
        // Convert numeric fields
        chainage_km: formData.chainage_km ? parseFloat(formData.chainage_km) : undefined,
        diameter_of_hole: formData.diameter_of_hole ? parseFloat(formData.diameter_of_hole) : undefined,
        standing_water_level: formData.standing_water_level ? parseFloat(formData.standing_water_level) : undefined,
        termination_depth: formData.termination_depth ? parseFloat(formData.termination_depth) : undefined,
        collar_elevation: formData.collar_elevation ? parseFloat(formData.collar_elevation.toString()) : undefined,
        // Handle coordinates
        coordinate: (formData.coordinate_lat && formData.coordinate_lng) ? {
          type: "Point" as const,
          coordinates: [parseFloat(formData.coordinate_lng), parseFloat(formData.coordinate_lat)] as [number, number]
        } : undefined,
        // Removed substructure_id as it's not part of the geological_log table
        // Format dates to match API expectations (YYYY-MM-DD)
        commencement_date: formatDateToAPI(formData.commencement_date),
        completion_date: formatDateToAPI(formData.completion_date)
      } as const;

      // Remove coordinate_lat and coordinate_lng as they're not part of the API schema
      delete (updateData as any).coordinate_lat;
      delete (updateData as any).coordinate_lng;

      try {
        await borelogApi.update(borelog.borelog_id, updateData);
      } catch (error: any) {
        if (error?.response?.status === 403) {
          toast({
            title: 'Permission Denied',
            description: 'Only Admin, Project Manager, and Site Engineer can edit borelogs. If you believe this is an error, please contact your administrator.',
            variant: 'destructive',
          });
        } else if (error?.response?.status === 401) {
          toast({
            title: 'Session Expired',
            description: 'Your session has expired. Please log in again.',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
        return;
      }

      // Update local state with the new values
      const updatedBorelog: GeologicalLog = {
        ...borelog,
        ...updateData,
        // Ensure coordinate type is correct
        coordinate: updateData.coordinate ? {
          type: "Point" as const,
          coordinates: updateData.coordinate.coordinates as [number, number]
        } : undefined
      };

      onUpdate(updatedBorelog);
      toast({
        title: 'Success',
        description: 'Borelog updated successfully',
      });
      setOpen(false);
    } catch (error) {
      console.error('Error updating borelog:', error);
      toast({
        title: 'Error',
        description: 'Failed to update borelog. Please check your input and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Guard against missing borelog data
  if (!borelog) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
                  <Button 
            variant="outline" 
            size="sm"
            title="Only Admin, Project Manager, and Site Engineer can edit borelogs"
          >
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[725px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Borelog</DialogTitle>
          <DialogDescription>
            Update the details for this borelog. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Project Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project_name">Project Name *</Label>
              <Input
                id="project_name"
                name="project_name"
                value={formData.project_name}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_name">Client Name *</Label>
              <Input
                id="client_name"
                name="client_name"
                value={formData.client_name}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="design_consultant">Design Consultant *</Label>
              <Input
                id="design_consultant"
                name="design_consultant"
                value={formData.design_consultant}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job_code">Job Code *</Label>
              <Input
                id="job_code"
                name="job_code"
                value={formData.job_code}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Location Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project_location">Project Location *</Label>
              <Input
                id="project_location"
                name="project_location"
                value={formData.project_location}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area">Area *</Label>
              <Input
                id="area"
                name="area"
                value={formData.area}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Borehole Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="borehole_location">Borehole Location *</Label>
              <Input
                id="borehole_location"
                name="borehole_location"
                value={formData.borehole_location}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="borehole_number">Borehole Number *</Label>
              <Input
                id="borehole_number"
                name="borehole_number"
                value={formData.borehole_number}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Technical Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="method_of_boring">Method of Boring *</Label>
              <Input
                id="method_of_boring"
                name="method_of_boring"
                value={formData.method_of_boring}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="diameter_of_hole">Diameter of Hole (mm) *</Label>
              <Input
                id="diameter_of_hole"
                name="diameter_of_hole"
                type="number"
                value={formData.diameter_of_hole}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="commencement_date">Commencement Date *</Label>
              <Input
                id="commencement_date"
                name="commencement_date"
                type="date"
                value={formData.commencement_date}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="completion_date">Completion Date *</Label>
              <Input
                id="completion_date"
                name="completion_date"
                type="date"
                value={formData.completion_date}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Measurements */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="standing_water_level">Standing Water Level (m)</Label>
              <Input
                id="standing_water_level"
                name="standing_water_level"
                type="number"
                step="0.01"
                value={formData.standing_water_level}
                onChange={handleInputChange}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="termination_depth">Termination Depth (m) *</Label>
              <Input
                id="termination_depth"
                name="termination_depth"
                type="number"
                step="0.01"
                value={formData.termination_depth}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="coordinate_lat">Latitude</Label>
              <Input
                id="coordinate_lat"
                name="coordinate_lat"
                type="number"
                step="0.000001"
                value={formData.coordinate_lat}
                onChange={handleInputChange}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coordinate_lng">Longitude</Label>
              <Input
                id="coordinate_lng"
                name="coordinate_lng"
                type="number"
                step="0.000001"
                value={formData.coordinate_lng}
                onChange={handleInputChange}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Additional Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type_of_core_barrel">Type of Core Barrel</Label>
              <Input
                id="type_of_core_barrel"
                name="type_of_core_barrel"
                value={formData.type_of_core_barrel}
                onChange={handleInputChange}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bearing_of_hole">Bearing of Hole</Label>
              <Input
                id="bearing_of_hole"
                name="bearing_of_hole"
                value={formData.bearing_of_hole}
                onChange={handleInputChange}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="msl">Mean Sea Level (MSL)</Label>
              <Input
                id="msl"
                name="msl"
                value={formData.msl}
                onChange={handleInputChange}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chainage_km">Chainage (km)</Label>
              <Input
                id="chainage_km"
                name="chainage_km"
                type="number"
                step="0.001"
                value={formData.chainage_km}
                onChange={handleInputChange}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Personnel */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="logged_by">Logged By *</Label>
              <Input
                id="logged_by"
                name="logged_by"
                value={formData.logged_by}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checked_by">Checked By *</Label>
              <Input
                id="checked_by"
                name="checked_by"
                value={formData.checked_by}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>
          
          {/* Substructure */}
          <div className="space-y-2">
            <Label htmlFor="substructure">Substructure</Label>
              <Select 
              value={formData.substructure_id}
              onValueChange={(value) => handleInputChange({ target: { name: 'substructure_id', value } } as any)}
              disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a substructure" />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="none">None</SelectItem>
                  {substructures.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name} ({sub.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}