import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import UnifiedLabReportForm from '@/components/UnifiedLabReportForm';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileText, Download, Eye } from 'lucide-react';

export default function UnifiedLabReportPage() {
  const navigate = useNavigate();
  const { requestId } = useParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Sample lab request data
  const sampleLabRequest = {
    id: requestId || 'LR-2024-001',
    borelog: {
      project_name: 'Highway Bridge Project - Phase 2',
      id: 'BL-2024-001'
    },
    sample_id: 'BH-4',
    requested_by: 'Dr. Sarah Johnson',
    test_type: 'Comprehensive Soil & Rock Tests'
  };

  // Sample existing report data
  const sampleExistingReport = {
    id: 'ULR-2024-001',
    request_id: requestId || 'LR-2024-001',
    borelog_id: 'BL-2024-001',
    sample_id: 'BH-4',
    submitted_by: 'Dr. Michael Chen',
    submitted_at: '2024-01-15T10:30:00Z',
    status: 'Draft',
    borelog: {
      project_name: 'Highway Bridge Project - Phase 2'
    }
  };

  const handleSubmit = async (reportData: any) => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Unified Lab Report Data:', reportData);
      
      toast({
        title: 'Success',
        description: 'Unified lab report submitted successfully! Both soil and rock test data have been saved.',
      });
      
      // Navigate back to lab reports list
      navigate('/lab-reports');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to submit unified lab report. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = async (reportData: any) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Draft saved:', reportData);
      
      toast({
        title: 'Draft Saved',
        description: 'Unified lab report draft has been saved successfully.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save draft. Please try again.',
      });
    }
  };

  const handleCancel = () => {
    navigate('/lab-reports');
  };

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              Unified Lab Report
            </h1>
            <p className="text-muted-foreground">
              Complete both soil and rock tests for comprehensive borelog analysis
            </p>
          </div>
        </div>
      </div>

      {/* Project Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Project Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium">Project Name</p>
              <p className="text-sm text-muted-foreground">{sampleLabRequest.borelog.project_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Borehole Number</p>
              <p className="text-sm text-muted-foreground">{sampleLabRequest.sample_id}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Request ID</p>
              <p className="text-sm text-muted-foreground">{sampleLabRequest.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unified Form */}
      <UnifiedLabReportForm
        labRequest={sampleLabRequest}
        existingReport={sampleExistingReport}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onSaveDraft={handleSaveDraft}
        isLoading={isLoading}
        userRole="Lab Engineer"
        isReadOnly={false}
      />
    </div>
  );
}
