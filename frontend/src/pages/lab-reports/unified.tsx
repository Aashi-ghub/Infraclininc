import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import UnifiedLabReportForm from '@/components/UnifiedLabReportForm';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileText, Download, Eye } from 'lucide-react';
import { unifiedLabReportsApi } from '@/lib/api';

export default function UnifiedLabReportPage() {
  const navigate = useNavigate();
  const { requestId, reportId } = useParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [existingReport, setExistingReport] = useState<any>(null);
  const [labRequest, setLabRequest] = useState<any>(null);

  // Load existing report if reportId is provided
  useEffect(() => {
    if (reportId) {
      loadExistingReport();
    }
  }, [reportId]);

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

  // Sample lab request data (in a real app, this would come from the backend)
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

  const handleSubmit = async (reportData: any) => {
    setIsLoading(true);
    try {
      if (existingReport) {
        // Update existing report
        const response = await unifiedLabReportsApi.update(existingReport.report_id, {
          soil_test_data: reportData.combined_data.soil,
          rock_test_data: reportData.combined_data.rock,
          test_types: reportData.test_types,
          status: 'submitted',
          remarks: reportData.remarks
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
          assignment_id: requestId || 'default-assignment',
          borelog_id: 'default-borelog',
          sample_id: reportData.borehole_no,
          project_name: reportData.project_name,
          borehole_no: reportData.borehole_no,
          client: reportData.client,
          test_date: reportData.date.toISOString(),
          tested_by: reportData.tested_by,
          checked_by: reportData.checked_by,
          approved_by: reportData.approved_by,
          test_types: reportData.test_types,
          soil_test_data: reportData.combined_data.soil,
          rock_test_data: reportData.combined_data.rock,
          status: 'submitted',
          remarks: reportData.remarks
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
      if (existingReport) {
        // Update existing report as draft
        const response = await unifiedLabReportsApi.update(existingReport.report_id, {
          soil_test_data: reportData.combined_data.soil,
          rock_test_data: reportData.combined_data.rock,
          test_types: reportData.test_types,
          status: 'draft',
          remarks: reportData.remarks
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
          assignment_id: requestId || 'default-assignment',
          borelog_id: 'default-borelog',
          sample_id: reportData.borehole_no,
          project_name: reportData.project_name,
          borehole_no: reportData.borehole_no,
          client: reportData.client,
          test_date: reportData.date.toISOString(),
          tested_by: reportData.tested_by,
          checked_by: reportData.checked_by,
          approved_by: reportData.approved_by,
          test_types: reportData.test_types,
          soil_test_data: reportData.combined_data.soil,
          rock_test_data: reportData.combined_data.rock,
          status: 'draft',
          remarks: reportData.remarks
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
