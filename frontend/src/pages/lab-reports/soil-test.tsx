import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ProtectedRoute } from '@/lib/authComponents';
import SoilLabReportForm from '@/components/SoilLabReportForm';
import { LabRequest } from '@/lib/types';
import { labReportApi } from '@/lib/api';

export default function SoilLabTestPage() {
  const navigate = useNavigate();
  const { requestId } = useParams<{ requestId: string }>();
  const [labRequest, setLabRequest] = useState<LabRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (requestId) {
      loadLabRequest();
    }
  }, [requestId]);

  const loadLabRequest = async () => {
    setIsLoading(true);
    try {
      const response = await labReportApi.getRequestById(requestId!);
      if (response.data?.success) {
        setLabRequest(response.data.data);
      } else {
        console.error('Failed to load lab request:', response.data?.message);
        toast({
          title: 'Error',
          description: 'Failed to load lab request data',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading lab request:', error);
      toast({
        title: 'Error',
        description: 'Failed to load lab request data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (formData: any) => {
    try {
      // Prepare the data for the API
      const labTestData = {
        assignment_id: requestId, // Using request ID as assignment ID
        sample_id: formData.sample_id,
        test_type: 'Soil Test',
        test_date: new Date().toISOString(),
        results: {
          // General Info
          lab_report_id: `SR-${Date.now()}`,
          lab_request_id: requestId,
          project_id: labRequest?.borelog?.project_name || '',
          borelog_id: labRequest?.borelog_id || '',
          requested_by: labRequest?.requested_by || '',
          lab_engineer_name: formData.lab_engineer_name || 'Dr. Michael Chen',
          report_status: 'Draft',
          
          // Sample Details
          sample_type: 'Soil',
          sample_depth: formData.sample_depth || 0,
          sample_description: formData.sample_description || '',
          moisture_condition: formData.moisture_condition || 'Moist',
          
          // Test Details
          test_method_standard: formData.test_method_standard || '',
          apparatus_used: formData.apparatus_used || '',
          technician_notes: formData.technician_notes || '',
          
          // Soil Test Results
          moisture_content: formData.moisture_content,
          dry_density: formData.dry_density,
          specific_gravity: formData.specific_gravity,
          plastic_limit: formData.plastic_limit,
          liquid_limit: formData.liquid_limit,
          shrinkage_limit: formData.shrinkage_limit,
          grain_size_distribution: formData.grain_size_distribution,
          permeability: formData.permeability,
          shear_strength: formData.shear_strength,
          atterberg_limits: {
            liquid_limit: formData.liquid_limit,
            plastic_limit: formData.plastic_limit,
            plasticity_index: formData.liquid_limit && formData.plastic_limit 
              ? formData.liquid_limit - formData.plastic_limit 
              : undefined
          },
          compaction_data: {
            moisture_content: formData.moisture_content,
            dry_density: formData.dry_density,
            optimum_moisture_content: formData.optimum_moisture_content,
            maximum_dry_density: formData.maximum_dry_density
          }
        },
        remarks: formData.technician_notes || ''
      };

      await labReportApi.createReport(labTestData);
      
      toast({
        title: 'Success',
        description: 'Soil lab report created successfully',
      });
      
      navigate('/lab-reports');
    } catch (error: any) {
      console.error('Error creating soil lab report:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create soil lab report',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading lab request data...</p>
        </div>
      </div>
    );
  }

  if (!labRequest) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Lab request not found</p>
          <Button onClick={() => navigate('/lab-reports')} className="mt-4">
            Back to Lab Reports
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Admin', 'Lab Engineer']}>
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate('/lab-reports')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Soil Lab Test Report</h1>
            <p className="text-gray-600 mt-2">
              Creating soil test report for {labRequest.sample_id} - {labRequest.borelog?.project_name}
            </p>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h3 className="font-medium text-blue-900 mb-2">Request Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">Sample ID:</span> {labRequest.sample_id}
            </div>
            <div>
              <span className="font-medium">Project:</span> {labRequest.borelog?.project_name}
            </div>
            <div>
              <span className="font-medium">Borehole:</span> {labRequest.borelog?.borehole_number}
            </div>
            <div>
              <span className="font-medium">Test Type:</span> {labRequest.test_type}
            </div>
            <div>
              <span className="font-medium">Requested By:</span> {labRequest.requested_by}
            </div>
            <div>
              <span className="font-medium">Priority:</span> {labRequest.priority}
            </div>
          </div>
        </div>

        <SoilLabReportForm
          labRequest={labRequest}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/lab-reports')}
        />
      </div>
    </ProtectedRoute>
  );
}
