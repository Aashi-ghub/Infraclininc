import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import UnifiedLabReportForm from '@/components/UnifiedLabReportForm';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileText, Download, Eye } from 'lucide-react';
import { unifiedLabReportsApi, labReportApi } from '@/lib/api';

// Helper function to validate UUID format
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
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

  // Use actual lab request data or fallback to sample data
  const sampleLabRequest = labRequest || {
    id: requestId || 'LR-2024-001',
    borelog: {
      project_name: 'Highway Bridge Project - Phase 2',
      id: 'BL-2024-001'
    },
    sample_id: 'BH-4',
    requested_by: 'Dr. Sarah Johnson',
    test_type: 'Comprehensive Soil & Rock Tests'
  };

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

      if (existingReport) {
        // Update existing report
        const response = await unifiedLabReportsApi.update(existingReport.report_id, {
          soil_test_data: soilTestData,
          rock_test_data: rockTestData,
          test_types: testTypes,
          status: 'submitted',
          remarks: reportData.review_comments || ''
        });
        
        if (response.data.success) {
          toast({
            title: 'Success',
            description: 'Unified lab report updated and submitted successfully!',
          });
          navigate('/lab-reports');
        } else {
          throw new Error(response.data.message || 'Failed to update report');
        }
      } else {
        // Create new report
        const createData = {
          assignment_id: isValidUUID(requestId || '') ? requestId : '00000000-0000-0000-0000-000000000001',
          borelog_id: '00000000-0000-0000-0000-000000000002',
          sample_id: reportData.borehole_no,
          project_name: reportData.project_name,
          borehole_no: reportData.borehole_no,
          client: reportData.client,
          test_date: reportData.date.toISOString(),
          tested_by: reportData.tested_by,
          checked_by: reportData.checked_by,
          approved_by: reportData.approved_by,
          test_types: testTypes,
          soil_test_data: soilTestData,
          rock_test_data: rockTestData,
          status: 'submitted',
          remarks: reportData.review_comments || ''
        };
        
        const response = await unifiedLabReportsApi.create(createData);
        
        if (response.data.success) {
          // Update the existing report with the actual UUID from the backend
          setExistingReport(response.data.data);
          toast({
            title: 'Success',
            description: 'Unified lab report created and submitted successfully!',
          });
          // Don't navigate away, stay on the form to allow further editing
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

      if (existingReport) {
        // Update existing report as draft
        const response = await unifiedLabReportsApi.update(existingReport.report_id, {
          soil_test_data: soilTestData,
          rock_test_data: rockTestData,
          test_types: testTypes,
          status: 'draft',
          remarks: reportData.review_comments || ''
        });
        
        if (response.data.success) {
          toast({
            title: 'Draft Saved',
            description: 'Unified lab report draft has been updated successfully.',
          });
        } else {
          throw new Error(response.data.message || 'Failed to save draft');
        }
      } else {
        // Create new draft
        const createData = {
          assignment_id: isValidUUID(requestId || '') ? requestId : null,
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
          status: 'draft',
          remarks: reportData.review_comments || ''
        };
        
        const response = await unifiedLabReportsApi.create(createData);
        
        if (response.data.success) {
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
       />
    </div>
  );
}
