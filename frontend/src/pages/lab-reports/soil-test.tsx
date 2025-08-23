import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ProtectedRoute } from '@/lib/authComponents';
import SoilLabReportForm from '@/components/SoilLabReportForm';
import { LabRequest, LabReport } from '@/lib/types';

// Mock data for demonstration
const mockLabRequest: LabRequest = {
  id: 'req-001',
  borelog_id: 'bl-001',
  sample_id: 'BH-1',
  test_type: 'Soil Test',
  requested_by: 'Project Manager',
  status: 'Pending',
  created_at: new Date().toISOString(),
  borelog: {
    id: 'bl-001',
    project_name: 'Highway Bridge Project - Jiribam-Tupul-Imphal Railway Line',
    borehole_number: 'BH-1',
    chainage: '2325 km'
  }
};

export default function SoilLabTestPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const handleSubmit = async (reportData: any) => {
    setIsSubmitting(true);
    try {
      // Here you would send the data to your backend API
      console.log('Submitting soil lab report:', reportData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: 'Success',
        description: 'Soil lab report submitted successfully',
      });
      
      // Navigate back to lab reports page
      navigate('/lab-reports');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to submit soil lab report',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async (reportData: any) => {
    setIsSavingDraft(true);
    try {
      // Here you would save the draft to your backend API
      console.log('Saving draft soil lab report:', reportData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: 'Draft Saved',
        description: 'Soil lab report draft saved successfully',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save draft',
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleCancel = () => {
    navigate('/lab-reports');
  };

  return (
    <ProtectedRoute allowedRoles={['Admin', 'Lab Engineer']}>
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Lab Reports
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Soil Lab Test Report</h1>
            <p className="text-muted-foreground">
              Create comprehensive soil laboratory test report
            </p>
          </div>
        </div>

        {/* Soil Lab Report Form */}
        <SoilLabReportForm
          labRequest={mockLabRequest}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onSaveDraft={handleSaveDraft}
          isLoading={isSubmitting}
          userRole="Lab Engineer"
          isReadOnly={false}
        />
      </div>
    </ProtectedRoute>
  );
}
