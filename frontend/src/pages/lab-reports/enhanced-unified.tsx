import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, FlaskConical } from 'lucide-react';
import EnhancedUnifiedLabReportForm from '@/components/EnhancedUnifiedLabReportForm';
import { labReportApi, labReportVersionControlApi } from '@/lib/api';
import { LabRequest, LabReport, UserRole } from '@/lib/types';

export default function EnhancedUnifiedLabReportPage() {
  const navigate = useNavigate();
  const { requestId, reportId } = useParams<{ requestId?: string; reportId?: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [labRequest, setLabRequest] = useState<LabRequest | null>(null);
  const [existingReport, setExistingReport] = useState<LabReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>('Lab Engineer');

  useEffect(() => {
    loadInitialData();
  }, [requestId, reportId]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      
      // Load lab request if requestId is provided
      if (requestId) {
        try {
          const requestResponse = await labReportApi.getRequest(requestId);
          if (requestResponse.data?.success) {
            setLabRequest(requestResponse.data.data);
          }
        } catch (error) {
          console.error('Error loading lab request:', error);
        }
      }

      // Load existing report if reportId is provided
      if (reportId) {
        try {
          const reportResponse = await labReportApi.getReport(reportId);
          if (reportResponse.data?.success) {
            setExistingReport(reportResponse.data.data);
          }
        } catch (error) {
          console.error('Error loading existing report:', error);
        }
      }

      // Set user role
      if (user) {
        setUserRole(user.role as UserRole);
      }

    } catch (error) {
      console.error('Error loading initial data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load initial data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (reportData: any) => {
    try {
      console.log('Form submitted with data:', reportData);
      
      // Navigate back to lab reports list
      navigate('/lab-reports');
      
      toast({
        title: 'Success',
        description: 'Lab report submitted successfully!',
      });
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit report',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    navigate('/lab-reports');
  };

  const handleSaveDraft = async (reportData: any) => {
    try {
      console.log('Draft saved with data:', reportData);
      
      toast({
        title: 'Success',
        description: 'Draft saved successfully!',
      });
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: 'Error',
        description: 'Failed to save draft',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading lab report form...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Lab Reports
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {existingReport ? 'Edit Lab Report' : 'Create Lab Report'}
            </h1>
            <p className="text-gray-600 mt-1">
              {existingReport 
                ? `Editing report for ${existingReport.borehole_no || 'Unknown borehole'}`
                : `Creating new report${labRequest ? ` for ${labRequest.sample_id}` : ''}`
              }
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <FlaskConical className="h-6 w-6 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">
            {userRole}
          </span>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {labRequest && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-700">
                Lab Request Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">Sample ID:</span> {labRequest.sample_id}
              </div>
              <div className="text-sm">
                <span className="font-medium">Test Type:</span> {labRequest.test_type}
              </div>
              <div className="text-sm">
                <span className="font-medium">Status:</span> 
                <span className={`ml-1 px-2 py-1 rounded-full text-xs ${
                  labRequest.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  labRequest.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {labRequest.status}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {existingReport && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-700">
                Current Report Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">Report ID:</span> {existingReport.report_id}
              </div>
              <div className="text-sm">
                <span className="font-medium">Version:</span> {existingReport.version_no || 1}
              </div>
              <div className="text-sm">
                <span className="font-medium">Status:</span> 
                <span className={`ml-1 px-2 py-1 rounded-full text-xs ${
                  existingReport.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                  existingReport.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                  existingReport.status === 'approved' ? 'bg-green-100 text-green-800' :
                  existingReport.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-orange-100 text-orange-800'
                }`}>
                  {existingReport.status}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700">
              User Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Name:</span> {user?.name || 'Unknown'}
            </div>
            <div className="text-sm">
              <span className="font-medium">Role:</span> {userRole}
            </div>
            <div className="text-sm">
              <span className="font-medium">Email:</span> {user?.email || 'Unknown'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Lab Report Form</span>
            {existingReport && (
              <span className="text-sm font-normal text-gray-500">
                (Version {existingReport.version_no || 1})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EnhancedUnifiedLabReportForm
            labRequest={labRequest || undefined}
            existingReport={existingReport || undefined}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onSaveDraft={handleSaveDraft}
            isLoading={isLoading}
            userRole={userRole}
            isReadOnly={userRole === 'Customer'}
            requestId={requestId}
          />
        </CardContent>
      </Card>
    </div>
  );
}






