import { useState } from 'react';
import { Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { GeologicalLog } from '@/lib/types';
import { borelogApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Export types needed by other components
export type Borelog = GeologicalLog;

export type Substructure = {
  id: string;
  name: string;
  type: string;
};

interface BorelogEditModalProps {
  borelog: Borelog;
  substructures: Substructure[];
  onUpdate: (updatedBorelog: Borelog) => void;
}

export function BorelogEditModal({ borelog, substructures, onUpdate }: BorelogEditModalProps) {
  const [open, setOpen] = useState(false);
  const [selectedSubstructure, setSelectedSubstructure] = useState(borelog.substructure_id || 'none');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      // Update only the substructure_id field
      await borelogApi.update(borelog.borelog_id, { 
        substructure_id: selectedSubstructure === 'none' ? null : selectedSubstructure
      });

      // Update local state with the new value
      const updatedBorelog = {
        ...borelog,
        substructure_id: selectedSubstructure === 'none' ? undefined : selectedSubstructure
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
        description: 'Failed to update borelog. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Borelog</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <div className="col-span-4">
              <p className="text-sm font-medium mb-2">Borelog ID: {borelog.borelog_id}</p>
              <p className="text-sm font-medium mb-2">Borehole Number: {borelog.borehole_number}</p>
              <p className="text-sm font-medium mb-2">Location: {borelog.borehole_location}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <div className="col-span-4">
              <label className="text-sm font-medium mb-2 block">Assign to Substructure</label>
              <Select 
                value={selectedSubstructure} 
                onValueChange={setSelectedSubstructure}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a substructure" />
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
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}