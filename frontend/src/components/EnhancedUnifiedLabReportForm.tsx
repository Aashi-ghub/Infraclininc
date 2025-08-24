import React, { useState, useEffect, useRef } from 'react';
import { useForm, FormProvider, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Save, Send, Download, Eye, FlaskConical, Mountain, FileText, CheckCircle, AlertCircle, History } from 'lucide-react';
import { LabRequest, LabReport, UserRole } from '@/lib/types';
import SoilLabReportForm from './SoilLabReportForm';
import RockLabReportForm from './RockLabReportForm';
import { exportUnifiedLabReportToExcel, UnifiedLabReportData } from '@/lib/labReportExporter';
import { labReportVersionControlApi } from '@/lib/api';
import { LabReportVersionHistory } from './LabReportVersionHistory';
import { LabReportFormActions } from './LabReportFormActions';

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

interface EnhancedUnifiedLabReportFormProps {
  labRequest?: LabRequest;
  existingReport?: LabReport;
  onSubmit: (reportData: any) => void;
  onCancel: () => void;
  onSaveDraft?: (reportData: any) => void;
  isLoading?: boolean;
  userRole?: UserRole;
  isReadOnly?: boolean;
  requestId?: string;
}

interface LabReportFormData {
  // General Info
  lab_report_id?: string;
  lab_request_id: string;
  project_name: string;
  borehole_no: string;
  client: string;
  date: Date;
  tested_by: string;
  checked_by: string;
  approved_by: string;
  report_status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  
  // Soil Test Data
  soil_test_data: any[];
  soil_test_completed: boolean;
  
  // Rock Test Data
  rock_test_data: any[];
  rock_test_completed: boolean;
  
  // Review Section
  reviewed_by?: string;
  review_comments?: string;
  approval_status?: 'Approved' | 'Rejected';
  approval_date?: Date;
  
  // Version Control
  version_number: number;
  status: string;
  remarks?: string;
  submission_comments?: string;
}

export default function EnhancedUnifiedLabReportForm({ 
  labRequest, 
  existingReport, 
  onSubmit, 
  onCancel, 
  onSaveDraft,
  isLoading = false,
  userRole = 'Lab Engineer',
  isReadOnly = false,
  requestId
}: EnhancedUnifiedLabReportFormProps) {
  const { user } = useAuth();
  const typedUser = user as any;
  const { toast } = useToast();
  
  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [activeVersionNo, setActiveVersionNo] = useState<number | null>(null);
  const [originalValues, setOriginalValues] = useState<any>(null);
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());
  const [currentStatus, setCurrentStatus] = useState('draft');
  const [currentVersion, setCurrentVersion] = useState(1);
  const isApplyingRef = useRef(false);

  // Check if user has editing permissions
  const canEdit = typedUser?.role === 'Admin' || typedUser?.role === 'Lab Engineer';
  const canApprove = typedUser?.role === 'Admin' || typedUser?.role === 'Approval Engineer';

  // Form setup
  const form = useForm<LabReportFormData>({
    defaultValues: {
      lab_report_id: existingReport?.report_id || existingReport?.id || '',
      lab_request_id: labRequest?.id || existingReport?.request_id || requestId || '',
      project_name: labRequest?.borelog?.project_name || existingReport?.borelog?.project_name || '',
      borehole_no: labRequest?.sample_id || existingReport?.sample_id || '',
      client: '',
      date: existingReport?.submitted_at ? new Date(existingReport.submitted_at) : new Date(),
      tested_by: 'Dr. Michael Chen',
      checked_by: 'Prof. Sarah Johnson',
      approved_by: 'Prof. David Wilson',
      report_status: existingReport?.status || 'Draft',
      soil_test_data: existingReport?.soil_test_data || [],
      soil_test_completed: false,
      rock_test_data: existingReport?.rock_test_data || [],
      rock_test_completed: false,
      reviewed_by: existingReport?.approved_by || '',
      review_comments: existingReport?.rejection_comments || '',
      approval_status: existingReport?.status === 'Approved' ? 'Approved' : 
                      existingReport?.status === 'Rejected' ? 'Rejected' : undefined,
      approval_date: existingReport?.approved_at ? new Date(existingReport.approved_at) : undefined,
      version_number: 1,
      status: 'draft',
      remarks: '',
      submission_comments: ''
    }
  });

  // Track form changes
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (name && originalValues && type === 'change') {
        const newValue = form.getValues(name as any);
        const oldValue = originalValues[name];
        
        if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
          setModifiedFields(prev => {
            const next = new Set(prev);
            next.add(name);
            return next;
          });
        } else {
          setModifiedFields(prev => {
            const next = new Set(prev);
            next.delete(name);
            return next;
          });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, originalValues]);

  // Load data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load version history
  const loadVersionHistory = async () => {
    const currentReportId = form.watch('lab_report_id');
    if (!currentReportId || !isValidUUID(currentReportId)) return;
    
    try {
      const response = await labReportVersionControlApi.getVersionHistory(currentReportId);
      console.log('Version history response:', response.data);
      
      if (response.data?.success) {
        const versionHistory = response.data.data?.versions || [];
        console.log('Setting versions:', versionHistory);
        setVersions(versionHistory);
      }
    } catch (error) {
      console.error('Error loading version history:', error);
    }
  };

  // Load initial data
  const loadInitialData = async () => {
    try {
      setIsLoadingData(true);
      await loadVersionHistory();
      
      // Set original values for change tracking
      setOriginalValues(form.getValues());
      setModifiedFields(new Set());
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Helper: map backend version data into our form fields
  const applyVersionToForm = async (version: any) => {
    console.log('Applying version to form:', version);
    
    isApplyingRef.current = true;
    try {
      const current = form.getValues();
      const next: any = { ...current };

      // Map version details to form fields
      if (version.details) {
        const details = version.details;
        
        // General info
        if (details.project_name !== undefined) next.project_name = String(details.project_name || '');
        if (details.borehole_no !== undefined) next.borehole_no = String(details.borehole_no || '');
        if (details.client !== undefined) next.client = String(details.client || '');
        if (details.test_date !== undefined) {
          try {
            next.date = new Date(details.test_date);
          } catch (e) {
            next.date = new Date();
          }
        }
        if (details.tested_by !== undefined) next.tested_by = String(details.tested_by || '');
        if (details.checked_by !== undefined) next.checked_by = String(details.checked_by || '');
        if (details.approved_by !== undefined) next.approved_by = String(details.approved_by || '');
        
        // Test data
        if (details.soil_test_data !== undefined) {
          next.soil_test_data = Array.isArray(details.soil_test_data) ? details.soil_test_data : [];
          next.soil_test_completed = next.soil_test_data.length > 0;
        }
        if (details.rock_test_data !== undefined) {
          next.rock_test_data = Array.isArray(details.rock_test_data) ? details.rock_test_data : [];
          next.rock_test_completed = next.rock_test_data.length > 0;
        }
        
        // Comments and remarks
        if (details.remarks !== undefined) next.remarks = String(details.remarks || '');
        if (details.submission_comments !== undefined) next.submission_comments = String(details.submission_comments || '');
        if (details.review_comments !== undefined) next.review_comments = String(details.review_comments || '');
      }

      // Version info
      if (version.version_no !== undefined) {
        next.version_number = version.version_no + 1;
        setCurrentVersion(version.version_no);
      }
      if (version.status !== undefined) {
        next.status = String(version.status || 'draft');
        setCurrentStatus(version.status);
      }

      // Apply all changes at once
      console.log('Applying form values:', next);
      form.reset(next);
      
      // Update tracking
      setOriginalValues(next);
      setModifiedFields(new Set());
      setActiveVersionNo(version.version_no);
      
    } finally {
      // Allow effects to resume after a tick
      setTimeout(() => {
        isApplyingRef.current = false;
      }, 0);
    }
  };

  // Load specific version
  const loadVersion = async (version: any) => {
    try {
      console.log('Loading version:', version);
      
      // Apply the version data to the form
      await applyVersionToForm(version);
      
      toast({
        title: 'Version Loaded',
        description: `Loaded Version ${version.version_no}`,
      });
    } catch (error) {
      console.error('Error loading version:', error);
      toast({
        title: 'Error',
        description: 'Failed to load version.',
        variant: 'destructive',
      });
    }
  };

  // Handle version approval
  const handleApproveVersion = async (versionNo: number) => {
    try {
      const reportId = form.watch('lab_report_id');
      if (!reportId) throw new Error('Missing report_id');
      
      await labReportVersionControlApi.review(reportId, {
        action: 'approve',
        version_no: versionNo,
        review_comments: 'Approved for final version'
      });
      
      toast({
        title: 'Success',
        description: `Version ${versionNo} approved successfully.`,
      });
      
      // Reload data to get updated status
      loadVersionHistory();
      
    } catch (error) {
      console.error('Error approving version:', error);
      const err: any = error;
      const serverMsg = err?.response?.data?.message;
      const serverErr = err?.response?.data?.error;
      const httpStatus = err?.response?.status;
      const description = serverMsg || serverErr || err?.message || 'Failed to approve version.';
      toast({
        title: 'Error',
        description: `${description}${httpStatus ? ` (HTTP ${httpStatus})` : ''}`,
        variant: 'destructive',
      });
    }
  };

  // Handle version rejection
  const handleRejectVersion = async (versionNo: number) => {
    try {
      const reportId = form.watch('lab_report_id');
      if (!reportId) throw new Error('Missing report_id');
      
      await labReportVersionControlApi.review(reportId, {
        action: 'reject',
        version_no: versionNo,
        review_comments: 'Changes needed before approval'
      });
      
      toast({
        title: 'Success',
        description: `Version ${versionNo} rejected. Please create a new version with requested changes.`,
      });
      
      // Reload data to get updated status
      loadVersionHistory();
      
    } catch (error) {
      console.error('Error rejecting version:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject version.',
        variant: 'destructive',
      });
    }
  };

  // Handle return for revision
  const handleReturnForRevision = async (versionNo: number) => {
    try {
      const reportId = form.watch('lab_report_id');
      if (!reportId) throw new Error('Missing report_id');
      
      await labReportVersionControlApi.review(reportId, {
        action: 'return_for_revision',
        version_no: versionNo,
        review_comments: 'Please revise and resubmit'
      });
      
      toast({
        title: 'Success',
        description: `Version ${versionNo} returned for revision.`,
      });
      
      // Reload data to get updated status
      loadVersionHistory();
      
    } catch (error) {
      console.error('Error returning version for revision:', error);
      toast({
        title: 'Error',
        description: 'Failed to return version for revision.',
        variant: 'destructive',
      });
    }
  };

  // Handle form submission
  const onSubmitForm: SubmitHandler<LabReportFormData> = async (data) => {
    if (!canEdit) return;
    
    try {
      setIsSubmitting(true);
      
      // Determine test types based on completed tests
      const testTypes = [];
      if (data.soil_test_completed) testTypes.push('Soil');
      if (data.rock_test_completed) testTypes.push('Rock');
      
      const payload = {
        report_id: data.lab_report_id,
        assignment_id: data.lab_request_id,
        borelog_id: labRequest?.borelog?.borelog_id || '',
        sample_id: data.borehole_no,
        project_name: data.project_name,
        borehole_no: data.borehole_no,
        client: data.client,
        test_date: data.date.toISOString(),
        tested_by: data.tested_by,
        checked_by: data.checked_by,
        approved_by: data.approved_by,
        test_types: testTypes,
        soil_test_data: data.soil_test_data,
        rock_test_data: data.rock_test_data,
        remarks: data.remarks,
        submission_comments: data.submission_comments
      };

      console.log('Submitting lab report with payload:', payload);
      
      if (data.lab_report_id && isValidUUID(data.lab_report_id)) {
        // Submit existing report for review
        const submitData = {
          report_id: data.lab_report_id,
          version_no: data.version_number,
          submission_comments: data.submission_comments || ''
        };
        
        const response = await labReportVersionControlApi.submitForReview(submitData);
        
        if (response.data.success) {
          toast({
            title: 'Success',
            description: 'Lab report submitted for review successfully!',
          });
          
          // Update tracking after successful submission
          setOriginalValues(form.getValues());
          setModifiedFields(new Set());
          
          // Reload version history
          await loadVersionHistory();
          
          // Call the original onSubmit callback
          onSubmit(data);
        } else {
          throw new Error(response.data.message || 'Failed to submit report');
        }
      } else {
        // Create new report
        const response = await labReportVersionControlApi.saveDraft(payload);
        
        if (response.data.success) {
          const newReport = response.data.data;
          form.setValue('lab_report_id', newReport.report_id);
          form.setValue('version_number', newReport.version_no + 1);
          setCurrentVersion(newReport.version_no);
          setCurrentStatus('draft');
          
          toast({
            title: 'Success',
            description: 'New lab report created successfully!',
          });
          
          // Update tracking
          setOriginalValues(form.getValues());
          setModifiedFields(new Set());
          
          // Call the original onSubmit callback
          onSubmit(data);
        } else {
          throw new Error(response.data.message || 'Failed to create report');
        }
      }
      
    } catch (error: any) {
      console.error('Submission error:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to submit lab report.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle save draft
  const handleSaveDraft = async () => {
    if (!canEdit) return;
    
    try {
      setIsSaving(true);
      const data = form.getValues();
      
      // Determine test types based on completed tests
      const testTypes = [];
      if (data.soil_test_completed) testTypes.push('Soil');
      if (data.rock_test_completed) testTypes.push('Rock');
      
      const payload = {
        report_id: data.lab_report_id,
        assignment_id: data.lab_request_id,
        borelog_id: labRequest?.borelog?.borelog_id || '',
        sample_id: data.borehole_no,
        project_name: data.project_name,
        borehole_no: data.borehole_no,
        client: data.client,
        test_date: data.date.toISOString(),
        tested_by: data.tested_by,
        checked_by: data.checked_by,
        approved_by: data.approved_by,
        test_types: testTypes,
        soil_test_data: data.soil_test_data,
        rock_test_data: data.rock_test_data,
        remarks: data.remarks
      };

      console.log('Saving lab report draft with payload:', payload);
      
      const response = await labReportVersionControlApi.saveDraft(payload);
      
      if (response.data.success) {
        const savedReport = response.data.data;
        
        // Update form with new report ID if it's a new report
        if (!data.lab_report_id) {
          form.setValue('lab_report_id', savedReport.report_id);
        }
        
        form.setValue('version_number', savedReport.version_no + 1);
        setCurrentVersion(savedReport.version_no);
        setCurrentStatus('draft');
        
        toast({
          title: 'Success',
          description: `Draft saved successfully! Version ${savedReport.version_no}`,
        });
        
        // Update tracking after successful save
        setOriginalValues(form.getValues());
        setModifiedFields(new Set());
        
        // Reload version history
        await loadVersionHistory();
        
        // Call the original onSaveDraft callback if provided
        if (onSaveDraft) {
          onSaveDraft(data);
        }
      } else {
        throw new Error(response.data.message || 'Failed to save draft');
      }
      
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to save draft.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle show version history
  const handleShowVersionHistory = () => {
    setShowVersionHistory(!showVersionHistory);
    if (!showVersionHistory) {
      loadVersionHistory();
    }
  };

  // Handle load latest version
  const handleLoadLatestVersion = () => {
    if (versions.length > 0) {
      loadVersion(versions[0]);
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading lab report form...</p>
        </div>
      </div>
    );
  }

  const hasUnsavedChanges = modifiedFields.size > 0;

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmitForm)} className="space-y-6">
          {/* Actions Bar */}
          <div className="flex justify-end">
            <LabReportFormActions
              isSubmitting={isSubmitting}
              isSaving={isSaving}
              canEdit={canEdit}
              canApprove={canApprove}
              onSave={handleSaveDraft}
              onShowVersionHistory={handleShowVersionHistory}
              showVersionHistory={showVersionHistory}
              reportId={form.watch('lab_report_id')}
              projectName={form.watch('project_name')}
              boreholeNumber={form.watch('borehole_no')}
              currentStatus={currentStatus}
              versionNumber={currentVersion}
              onLoadLatestVersion={handleLoadLatestVersion}
              hasUnsavedChanges={hasUnsavedChanges}
            />
          </div>

          {/* Version History Panel */}
          {showVersionHistory && (
            <LabReportVersionHistory
              versions={versions}
              canApprove={canApprove}
              form={form}
              onLoadVersion={loadVersion}
              onApproveVersion={handleApproveVersion}
              onRejectVersion={handleRejectVersion}
              onReturnForRevision={handleReturnForRevision}
              activeVersionNo={activeVersionNo}
            />
          )}

          {/* Main Form Content */}
          <Card>
            <CardContent className="p-6">
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="general">General Info</TabsTrigger>
                  <TabsTrigger value="soil">Soil Tests</TabsTrigger>
                  <TabsTrigger value="rock">Rock Tests</TabsTrigger>
                  <TabsTrigger value="review">Review</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4">
                  {/* General Information Form */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Project Name</label>
                      <input
                        type="text"
                        {...form.register('project_name')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Borehole Number</label>
                      <input
                        type="text"
                        {...form.register('borehole_no')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Client</label>
                      <input
                        type="text"
                        {...form.register('client')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Test Date</label>
                      <input
                        type="date"
                        {...form.register('date')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tested By</label>
                      <input
                        type="text"
                        {...form.register('tested_by')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Checked By</label>
                      <input
                        type="text"
                        {...form.register('checked_by')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Approved By</label>
                      <input
                        type="text"
                        {...form.register('approved_by')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Remarks</label>
                      <textarea
                        {...form.register('remarks')}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="soil" className="space-y-4">
                  <SoilLabReportForm
                    form={form}
                    canEdit={canEdit}
                  />
                </TabsContent>

                <TabsContent value="rock" className="space-y-4">
                  <RockLabReportForm
                    form={form}
                    canEdit={canEdit}
                  />
                </TabsContent>

                <TabsContent value="review" className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Submission Comments</label>
                      <textarea
                        {...form.register('submission_comments')}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        disabled={!canEdit}
                        placeholder="Add any comments for the reviewer..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Review Comments</label>
                      <textarea
                        {...form.register('review_comments')}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        disabled={!canEdit}
                        placeholder="Review comments will appear here..."
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </form>
      </FormProvider>
    </div>
  );
}
