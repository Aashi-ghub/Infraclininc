import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RockLabReportForm from '@/components/RockLabReportForm';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileText, Download, Eye } from 'lucide-react';

export default function RockLabTestPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Sample lab request data
  const sampleLabRequest = {
    id: 'LR-2024-001',
    borelog: {
      project_name: 'Highway Bridge Project - Phase 2',
      id: 'BL-2024-001'
    },
    sample_id: 'Rock_BH.4',
    requested_by: 'Dr. Sarah Johnson',
    test_type: 'Rock Mechanics Tests'
  };

  // Sample existing report data
  const sampleExistingReport = {
    id: 'RR-2024-001',
    request_id: 'LR-2024-001',
    borelog_id: 'BL-2024-001',
    sample_id: 'Rock_BH.4',
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
      
      console.log('Rock Lab Report Data:', reportData);
      
      toast({
        title: 'Success',
        description: 'Rock lab test report submitted successfully!',
      });
      
      // Navigate back to lab reports list
      navigate('/lab-reports');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to submit rock lab test report. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = async (reportData: any) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Draft Saved:', reportData);
      
      toast({
        title: 'Draft Saved',
        description: 'Rock lab test report draft saved successfully!',
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
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/lab-reports')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Lab Reports
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Rock Lab Test Report</h1>
            <p className="text-muted-foreground">
              Create comprehensive rock mechanics test report
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Project Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div><span className="font-medium">Project:</span> Highway Bridge Project - Phase 2</div>
              <div><span className="font-medium">Borehole:</span> Rock_BH.4</div>
              <div><span className="font-medium">Request ID:</span> LR-2024-001</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Test Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div><span className="font-medium">Test Type:</span> Rock Mechanics Tests</div>
              <div><span className="font-medium">Methods:</span> Caliper, Buoyancy, Point Load, UCS, Brazilian</div>
              <div><span className="font-medium">Samples:</span> 10 samples (0.50m - 5.00m)</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div><span className="font-medium">Current:</span> Draft</div>
              <div><span className="font-medium">Lab Engineer:</span> Dr. Michael Chen</div>
              <div><span className="font-medium">Last Updated:</span> Today</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rock Lab Report Form */}
      <RockLabReportForm
        labRequest={sampleLabRequest}
        existingReport={sampleExistingReport}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onSaveDraft={handleSaveDraft}
        isLoading={isLoading}
        userRole="Lab Engineer"
        isReadOnly={false}
      />

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Rock Test Report Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Test Methods Included:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• <strong>Caliper Method:</strong> Sample dimensions and basic properties</li>
                <li>• <strong>Buoyancy Techniques:</strong> Weight measurements in different conditions</li>
                <li>• <strong>Water Displacement:</strong> Volume and density calculations</li>
                <li>• <strong>Point Load Test:</strong> Point load index determination</li>
                <li>• <strong>UCS Test:</strong> Uniaxial compressive strength</li>
                <li>• <strong>Brazilian Test:</strong> Tensile strength measurement</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Key Features:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• <strong>Auto-calculation:</strong> Automatic computation of derived values</li>
                <li>• <strong>Data Validation:</strong> Range checking and format validation</li>
                <li>• <strong>Bulk Operations:</strong> Add/remove multiple sample rows</li>
                <li>• <strong>Export Options:</strong> PDF and Excel export functionality</li>
                <li>• <strong>Version Control:</strong> Track changes and revisions</li>
                <li>• <strong>Professional Layout:</strong> Matches industry standards</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
