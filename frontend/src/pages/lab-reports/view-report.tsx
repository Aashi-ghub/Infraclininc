import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, FlaskConical, Mountain, Save, Send, Download } from 'lucide-react';
import { unifiedLabReportsApi } from '@/lib/api';
import UnifiedLabReportForm from '@/components/UnifiedLabReportForm';

interface UnifiedLabReport {
  report_id: string;
  assignment_id?: string;
  borelog_id: string;
  sample_id: string;
  project_name: string;
  borehole_no: string;
  client: string;
  test_date: string;
  tested_by: string;
  checked_by: string;
  approved_by: string;
  test_types: string[];
  soil_test_data: any[];
  rock_test_data: any[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  remarks?: string;
  created_at: string;
  created_by_user_id: string;
}

export default function ViewReportPage() {
  const navigate = useNavigate();
  const { reportId } = useParams<{ reportId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [report, setReport] = useState<UnifiedLabReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (reportId) {
      loadReport();
    }
  }, [reportId]);

  const loadReport = async () => {
    try {
      setIsLoading(true);
      console.log('Loading report with ID:', reportId);
      
      const response = await unifiedLabReportsApi.getById(reportId!);
      console.log('API Response:', response);
      
      if (response.data.success) {
        console.log('Report data:', response.data.data);
        setReport(response.data.data);
      } else {
        console.error('API returned error:', response.data);
        toast({
          title: 'Error',
          description: response.data.message || 'Failed to load report',
          variant: 'destructive'
        });
        navigate('/lab-reports');
      }
    } catch (error) {
      console.error('Error loading report:', error);
      toast({
        title: 'Error',
        description: 'Failed to load report',
        variant: 'destructive'
      });
      navigate('/lab-reports');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = async (reportData: any) => {
    try {
      setIsSaving(true);
      
      const updateData = {
        soil_test_data: reportData.soil_test_data,
        rock_test_data: reportData.rock_test_data,
        test_types: reportData.test_types,
        status: 'draft',
        remarks: reportData.remarks
      };

      const response = await unifiedLabReportsApi.update(reportId!, updateData);
      
      if (response.data.success) {
        toast({
          title: 'Success',
          description: 'Report saved as draft',
        });
        // Reload the report to get updated data
        await loadReport();
      } else {
        toast({
          title: 'Error',
          description: response.data.message || 'Failed to save report',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error saving report:', error);
      toast({
        title: 'Error',
        description: 'Failed to save report',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (reportData: any) => {
    try {
      setIsSubmitting(true);
      
      const updateData = {
        soil_test_data: reportData.soil_test_data,
        rock_test_data: reportData.rock_test_data,
        test_types: reportData.test_types,
        status: 'submitted',
        remarks: reportData.remarks
      };

      const response = await unifiedLabReportsApi.update(reportId!, updateData);
      
      if (response.data.success) {
        toast({
          title: 'Success',
          description: 'Report submitted for approval',
        });
        // Reload the report to get updated data
        await loadReport();
      } else {
        toast({
          title: 'Error',
          description: response.data.message || 'Failed to submit report',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit report',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/lab-reports');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { color: 'bg-gray-100 text-gray-800', label: 'Draft' },
      submitted: { color: 'bg-blue-100 text-blue-800', label: 'Submitted' },
      approved: { color: 'bg-green-100 text-green-800', label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const getTestTypesBadge = (testTypes: string[]) => {
    if (!testTypes || testTypes.length === 0) {
      return <Badge variant="outline">No tests</Badge>;
    }

    return (
      <div className="flex gap-1">
        {testTypes.map((type, index) => (
          <Badge key={index} variant="outline" className="text-xs">
            {type === 'Soil' ? <FlaskConical className="w-3 h-3 mr-1" /> : <Mountain className="w-3 h-3 mr-1" />}
            {type}
          </Badge>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <span className="ml-2">Loading report...</span>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">
          <p className="text-gray-500">Report not found</p>
          <Button onClick={() => navigate('/lab-reports')} className="mt-4">
            Back to Reports
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/lab-reports')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Lab Report</h1>
            <p className="text-gray-600 mt-1">View and edit laboratory test report</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Report Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700">
              Report Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Report ID:</span> {report.report_id}
            </div>
            <div className="text-sm">
              <span className="font-medium">Sample ID:</span> {report.sample_id}
            </div>
            <div className="text-sm">
              <span className="font-medium">Status:</span> {getStatusBadge(report.status)}
            </div>
            <div className="text-sm">
              <span className="font-medium">Test Types:</span> {getTestTypesBadge(report.test_types)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700">
              Project Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Project:</span> {report.project_name || 'N/A'}
            </div>
            <div className="text-sm">
              <span className="font-medium">Borehole:</span> {report.borehole_no || 'N/A'}
            </div>
            <div className="text-sm">
              <span className="font-medium">Client:</span> {report.client || 'N/A'}
            </div>
            <div className="text-sm">
              <span className="font-medium">Test Date:</span> {new Date(report.test_date).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700">
              Sample Count
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Soil Samples:</span> {report.soil_test_data?.length || 0}
            </div>
            <div className="text-sm">
              <span className="font-medium">Rock Samples:</span> {report.rock_test_data?.length || 0}
            </div>
            <div className="text-sm">
              <span className="font-medium">Total:</span> {(report.soil_test_data?.length || 0) + (report.rock_test_data?.length || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Lab Report Form</span>
            {report && (
              <span className="text-sm font-normal text-gray-500">
                (ID: {report.report_id})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UnifiedLabReportForm
            existingReport={report}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onSaveDraft={handleSaveDraft}
            isLoading={isSaving || isSubmitting}
            userRole={user?.role || 'Lab Engineer'}
            isReadOnly={report.status === 'approved'}
          />
        </CardContent>
      </Card>
    </div>
  );
}
