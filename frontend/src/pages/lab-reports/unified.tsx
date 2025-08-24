import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import UnifiedLabReportForm from '@/components/UnifiedLabReportForm';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileText, Download, Eye } from 'lucide-react';
import { unifiedLabReportsApi, labReportApi, labReportVersionControlApi } from '@/lib/api';

// Helper function to validate UUID format
const isValidUUID = (uuid: string): boolean => {
  // Check for complete UUID format (5 parts)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(uuid)) {
    return true;
  }
  
  // Check for assignment_id-index format (6+ parts)
  const parts = uuid.split('-');
  if (parts.length >= 6) {
    // Check if the first 5 parts form a valid UUID
    const assignmentId = parts.slice(0, -1).join('-');
    return uuidRegex.test(assignmentId);
  }
  
  return false;
};

export default function UnifiedLabReportPage() {
  const navigate = useNavigate();
  const { requestId, reportId } = useParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [existingReport, setExistingReport] = useState<any>(null);
  const [labRequest, setLabRequest] = useState<any>(null);

  // Load existing report if reportId is provided, or load lab request if requestId is provided
  useEffect(() => {
    if (reportId) {
      loadExistingReport();
    } else if (requestId) {
      loadLabRequest();
    }
  }, [reportId, requestId]);

  const loadExistingReport = async () => {
    try {
      setIsLoading(true);
      const response = await unifiedLabReportsApi.getById(reportId!);
      if (response.data.success) {
        setExistingReport(response.data.data);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load existing report',
        });
      }
    } catch (error) {
      console.error('Error loading existing report:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load existing report',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadLabRequest = async () => {
    setIsLoading(true);
    try {
      // Validate UUID format before making API call
      if (!isValidUUID(requestId!)) {
        console.error('Invalid UUID format:', requestId);
        toast({
          title: 'Error',
          description: 'Invalid request ID format. Please check the URL.',
          variant: 'destructive',
        });
        return;
      }

      const response = await labReportApi.getRequestById(requestId!);
      if (response.data?.success) {
        const labRequestData = response.data.data;
        setLabRequest(labRequestData);
        
        // If the lab request has a report_id, set it as the existing report
        // so that version buttons become visible
        if (labRequestData.report_id) {
          setExistingReport({
            report_id: labRequestData.report_id,
            id: labRequestData.report_id, // For compatibility
            status: 'draft',
            version_no: 1,
            created_at: labRequestData.requested_date || new Date().toISOString()
          });
        }
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

  // Use actual lab request data or fallback to sample data
  const sampleLabRequest = labRequest || {
    id: requestId || 'LR-2024-001',
    report_id: requestId ? `${requestId}-report` : 'LR-2024-001-report', // Generate a report_id for sample data
    borelog: {
      project_name: 'Highway Bridge Project - Phase 2',
      id: 'BL-2024-001'
    },
    sample_id: 'BH-4',
    requested_by: 'Dr. Sarah Johnson',
    test_type: 'Comprehensive Soil & Rock Tests'
  };

  // If we have an invalid UUID, show a helpful message
  if (requestId && !isValidUUID(requestId)) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Invalid Request ID</h2>
            <p className="text-red-600 mb-4">
              The request ID in the URL is not in the correct format. 
              Please check the URL and try again.
            </p>
            <p className="text-sm text-red-500 mb-4">
              Received: <code className="bg-red-100 px-2 py-1 rounded">{requestId}</code>
            </p>
            <Button onClick={() => navigate('/lab-reports')} variant="outline">
              Back to Lab Reports
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (reportData: any) => {
    setIsLoading(true);
    try {
      // Determine test types based on completed tests
      const testTypes = [];
      if (reportData.soil_test_completed) testTypes.push('Soil');
      if (reportData.rock_test_completed) testTypes.push('Rock');
      
      // Ensure we always have valid arrays
      const soilTestData = Array.isArray(reportData.soil_test_data) ? reportData.soil_test_data : [];
      const rockTestData = Array.isArray(reportData.rock_test_data) ? reportData.rock_test_data : [];

      // Get the assignment_id and report_id from the lab request
      const assignmentId = labRequest?.id || sampleLabRequest?.id || requestId;
      const reportId = labRequest?.report_id || sampleLabRequest?.report_id;

      if (existingReport) {
        // Submit existing report for review using version control API
        const submitData = {
          report_id: existingReport.report_id || existingReport.id,
          version_no: existingReport.version_no || 1,
          submission_comments: reportData.review_comments || ''
        };
        
        const response = await labReportVersionControlApi.submitForReview(submitData);
        
        if (response.data.success) {
          toast({
            title: 'Success',
            description: 'Unified lab report submitted for review successfully!',
          });
          navigate('/lab-reports');
        } else {
          throw new Error(response.data.message || 'Failed to submit report');
        }
      } else {
        // Create new report and submit using version control API
        const createData = {
          report_id: reportId, // Use report_id from lab request if available
          assignment_id: assignmentId,
          borelog_id: labRequest?.borelog_id || sampleLabRequest?.borelog_id || '',
          sample_id: labRequest?.sample_id || reportData.borehole_no,
          project_name: labRequest?.borelog?.project_name || reportData.project_name,
          borehole_no: labRequest?.borelog?.borehole_number || reportData.borehole_no,
          client: reportData.client,
          test_date: reportData.date.toISOString(),
          tested_by: reportData.tested_by,
          checked_by: reportData.checked_by,
          approved_by: reportData.approved_by,
          test_types: testTypes,
          soil_test_data: soilTestData,
          rock_test_data: rockTestData,
          remarks: reportData.review_comments || ''
        };
        
        const response = await labReportVersionControlApi.saveDraft(createData);
        
        if (response.data.success) {
          // Create a mock existing report object with the data from version control API
          const mockExistingReport = {
            report_id: response.data.data.report_id,
            id: response.data.data.report_id, // For compatibility
            status: response.data.data.status,
            version_no: response.data.data.version_no,
            created_at: response.data.data.created_at
          };
          
          // Update the existing report with the actual UUID from the backend
          setExistingReport(mockExistingReport);
          
          // Now submit for review
          const submitData = {
            report_id: response.data.data.report_id,
            version_no: response.data.data.version_no,
            submission_comments: reportData.review_comments || ''
          };
          
          const submitResponse = await labReportVersionControlApi.submitForReview(submitData);
          
          if (submitResponse.data.success) {
            // Update the URL to include the report_id so the component knows it's in edit mode
            navigate(`/lab-reports/unified/${response.data.data.report_id}`, { replace: true });
            toast({
              title: 'Success',
              description: 'Unified lab report created and submitted for review successfully!',
            });
          } else {
            throw new Error(submitResponse.data.message || 'Failed to submit report');
          }
        } else {
          throw new Error(response.data.message || 'Failed to create report');
        }
      }
    } catch (error) {
      console.error('Error submitting unified lab report:', error);
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
      // Determine test types based on completed tests
      // For drafts, we can have empty test types, but we must ensure it's always an array
      const testTypes = [];
      if (reportData.soil_test_completed) testTypes.push('Soil');
      if (reportData.rock_test_completed) testTypes.push('Rock');
      
      // Ensure we always have valid arrays
      const soilTestData = Array.isArray(reportData.soil_test_data) ? reportData.soil_test_data : [];
      const rockTestData = Array.isArray(reportData.rock_test_data) ? reportData.rock_test_data : [];

      // Get the assignment_id and report_id from the lab request
      const assignmentId = labRequest?.id || sampleLabRequest?.id || requestId;
      const reportId = labRequest?.report_id || sampleLabRequest?.report_id;

      if (existingReport) {
        // Update existing draft using version control API
        const updateData = {
          report_id: existingReport.report_id || existingReport.id,
          assignment_id: assignmentId,
          borelog_id: labRequest?.borelog_id || sampleLabRequest?.borelog_id || '',
          sample_id: labRequest?.sample_id || reportData.borehole_no,
          project_name: labRequest?.borelog?.project_name || reportData.project_name,
          borehole_no: labRequest?.borelog?.borehole_number || reportData.borehole_no,
          client: reportData.client,
          test_date: reportData.date.toISOString(),
          tested_by: reportData.tested_by,
          checked_by: reportData.checked_by,
          approved_by: reportData.approved_by,
          test_types: testTypes,
          soil_test_data: soilTestData,
          rock_test_data: rockTestData,
          remarks: reportData.review_comments || ''
        };
        
        const response = await labReportVersionControlApi.saveDraft(updateData);
        
        if (response.data.success) {
          // Update the existing report with the new version info
          const updatedExistingReport = {
            ...existingReport,
            version_no: response.data.data.version_no,
            status: response.data.data.status
          };
          setExistingReport(updatedExistingReport);
          
          toast({
            title: 'Draft Saved',
            description: `Unified lab report draft has been saved as version ${response.data.data.version_no}.`,
          });
        } else {
          throw new Error(response.data.message || 'Failed to save draft');
        }
      } else {
        // Create new draft using version control API
        const createData = {
          report_id: reportId, // Use report_id from lab request if available
          assignment_id: assignmentId,
          borelog_id: labRequest?.borelog_id || sampleLabRequest?.borelog_id || '',
          sample_id: labRequest?.sample_id || reportData.borehole_no,
          project_name: labRequest?.borelog?.project_name || reportData.project_name,
          borehole_no: labRequest?.borelog?.borehole_number || reportData.borehole_no,
          client: reportData.client,
          test_date: reportData.date.toISOString(),
          tested_by: reportData.tested_by,
          checked_by: reportData.checked_by,
          approved_by: reportData.approved_by,
          test_types: testTypes,
          soil_test_data: soilTestData,
          rock_test_data: rockTestData,
          remarks: reportData.review_comments || ''
        };
        
        const response = await labReportVersionControlApi.saveDraft(createData);
        
        if (response.data.success) {
          // Create a mock existing report object with the data from version control API
          const mockExistingReport = {
            report_id: response.data.data.report_id,
            id: response.data.data.report_id, // For compatibility
            status: response.data.data.status,
            version_no: response.data.data.version_no,
            created_at: response.data.data.created_at
          };
          
          // Update the existing report with the actual UUID from the backend
          setExistingReport(mockExistingReport);
          // Update the URL to include the report_id so the component knows it's in edit mode
          navigate(`/lab-reports/unified/${response.data.data.report_id}`, { replace: true });
          toast({
            title: 'Draft Saved',
            description: 'Unified lab report draft has been created successfully.',
          });
        } else {
          throw new Error(response.data.message || 'Failed to save draft');
        }
      }
    } catch (error) {
      console.error('Error saving draft:', error);
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
      {/* Unified Form */}
       <UnifiedLabReportForm
         labRequest={sampleLabRequest}
         existingReport={existingReport}
         onSubmit={handleSubmit}
         onCancel={handleCancel}
         onSaveDraft={handleSaveDraft}
         isLoading={isLoading}
         userRole="Lab Engineer"
         isReadOnly={false}
         requestId={requestId} // Pass the requestId so the form can use it for version history
       />
    </div>
  );
}
