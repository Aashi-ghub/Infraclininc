import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { LabRequest } from '@/lib/types';
import { labReportApi, userApi, workflowApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';



interface Borelog {
  borelog_id: string;
  borehole_number: string;
  project_name: string;
  chainage?: string;
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

interface LabRequestFormProps {
  onSubmit: (data: Omit<LabRequest, 'id' | 'requested_date' | 'status'>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function LabRequestForm({ onSubmit, onCancel, isLoading = false }: LabRequestFormProps) {
  const [formData, setFormData] = useState({
    borelog_id: '',
    sample_id: '',
    assigned_lab_engineer: '',
    due_date: '',
    notes: ''
  });

  const [borelogs, setBorelogs] = useState<Borelog[]>([]);
  const [approvedBorelogs, setApprovedBorelogs] = useState<Borelog[]>([]);
  const [labEngineers, setLabEngineers] = useState<LabEngineer[]>([]);
  const [isLoadingBorelogs, setIsLoadingBorelogs] = useState(false);
  const [isLoadingEngineers, setIsLoadingEngineers] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();



  useEffect(() => {
    loadBorelogs();
    if (user?.role === 'Admin' || user?.role === 'Project Manager') {
      loadApprovedBorelogs();
      loadLabEngineers();
    }
  }, [user]);

  const loadBorelogs = async () => {
    setIsLoadingBorelogs(true);
    try {
      const response = await labReportApi.getFinalBorelogs();
      if (response.data?.success) {
        // Transform the final borelogs to match the expected format
        const transformedBorelogs = response.data.data.map((borelog: any) => ({
          borelog_id: borelog.borelog_id,
          borehole_number: borelog.borehole_number,
          project_name: borelog.project_name,
          chainage: borelog.project_location ? `${borelog.project_location}` : undefined
        }));
        setBorelogs(transformedBorelogs);
      } else {
        console.error('Failed to load borelogs:', response.data?.message);
        toast({
          title: 'Error',
          description: 'Failed to load borelogs',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading borelogs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load borelogs',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingBorelogs(false);
    }
  };

  const loadApprovedBorelogs = async () => {
    try {
      const response = await labReportApi.getFinalBorelogs();
      if (response.data?.success) {
        const allBorelogs = response.data.data || [];
        const approved = allBorelogs.filter((borelog: any) => borelog.status === 'approved');
        const transformedBorelogs = approved.map((borelog: any) => ({
          borelog_id: borelog.borelog_id,
          borehole_number: borelog.borehole_number,
          project_name: borelog.project_name,
          chainage: borelog.project_location ? `${borelog.project_location}` : undefined
        }));
        setApprovedBorelogs(transformedBorelogs);
      }
    } catch (error) {
      console.error('Error fetching approved borelogs:', error);
      setApprovedBorelogs([]);
    }
  };

  const loadLabEngineers = async () => {
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

  const filteredBorelogs = borelogs; // Show all borelogs since there's no search for borelogs

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.borelog_id || !formData.sample_id) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    const selectedBorelog = borelogs.find(b => b.borelog_id === formData.borelog_id);

    // If assignment fields are filled, create assignment
    if (formData.assigned_lab_engineer) {
      try {
        await workflowApi.assignLabTests({
          borelog_id: formData.borelog_id,
          sample_ids: [formData.sample_id],
          test_types: ['Standard Lab Test'], // Default test type
          assigned_lab_engineer: formData.assigned_lab_engineer,
          priority: 'medium', // Default priority
          expected_completion_date: formData.due_date
        });

        toast({
          title: 'Success',
          description: 'Lab test assigned successfully',
        });
        
        // Reset form
        setFormData({
          borelog_id: '',
          sample_id: '',
          assigned_lab_engineer: '',
          due_date: '',
          notes: ''
        });
        return;
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.response?.data?.message || 'Failed to assign lab test',
        });
        return;
      }
    }

    // Otherwise, create regular lab request
    onSubmit({
      borelog_id: formData.borelog_id,
      sample_id: formData.sample_id,
      test_type: 'Standard Lab Test', // Default test type
      priority: 'medium', // Default priority
      due_date: formData.due_date || undefined,
      notes: formData.notes,
      requested_by: user?.name || user?.email || 'Unknown',
      borelog: selectedBorelog ? {
        borehole_number: selectedBorelog.borehole_number,
        project_name: selectedBorelog.project_name,
        chainage: selectedBorelog.chainage || 'N/A'
      } : undefined
    });
  };



  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Lab Test Request Details</CardTitle>
          <p className="text-sm text-muted-foreground">
            {user?.role === 'Site Engineer' 
              ? 'Create lab test requests for your assigned borelogs'
              : 'Create lab test requests or assign tests to lab engineers'
            }
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Borelog Selection */}
          <div className="space-y-2">
            <Label htmlFor="borelog">Borelog *</Label>
            <Select value={formData.borelog_id} onValueChange={(value) => setFormData(prev => ({ ...prev, borelog_id: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a borelog" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingBorelogs ? (
                  <SelectItem value="loading" disabled>Loading borelogs...</SelectItem>
                ) : filteredBorelogs.length === 0 ? (
                  <SelectItem value="no-borelogs" disabled>No borelogs found</SelectItem>
                ) : (
                  filteredBorelogs.map((borelog) => (
                    <SelectItem key={borelog.borelog_id} value={borelog.borelog_id}>
                      {borelog.borehole_number} - {borelog.project_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Sample ID */}
          <div className="space-y-2">
            <Label htmlFor="sample_id">Sample ID *</Label>
            <Input
              id="sample_id"
              value={formData.sample_id}
              onChange={(e) => setFormData(prev => ({ ...prev, sample_id: e.target.value }))}
              placeholder="Enter sample ID"
              required
            />
          </div>



          {/* Assignment Fields - Only for Admin and Project Manager */}
          {(user?.role === 'Admin' || user?.role === 'Project Manager') && (
            <>
              {/* Lab Engineer Assignment */}
              <div className="space-y-2">
                <Label htmlFor="assigned_lab_engineer">Assign to Lab Engineer</Label>
                <Select value={formData.assigned_lab_engineer || ''} onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_lab_engineer: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select lab engineer (optional)" />
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



              {/* Due Date */}
              <div className="space-y-2">
                <Label htmlFor="due_date">Expected Completion Date</Label>
                <Input
                  type="date"
                  value={formData.due_date || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes or instructions..."
                  rows={3}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : (formData.assigned_lab_engineer ? 'Create & Assign' : 'Create Lab Request')}
        </Button>
      </div>
    </form>
  );
}
