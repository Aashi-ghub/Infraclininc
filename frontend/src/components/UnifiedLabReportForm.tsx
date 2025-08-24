import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Save, Send, Download, Eye, FlaskConical, Mountain, FileText, CheckCircle, AlertCircle, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LabRequest, LabReport, UserRole } from '@/lib/types';
import SoilLabReportForm from './SoilLabReportForm';
import RockLabReportForm from './RockLabReportForm';
import { exportUnifiedLabReportToExcel, UnifiedLabReportData } from '@/lib/labReportExporter';
import { labReportVersionControlApi } from '@/lib/api';

// Helper function to validate UUID format
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

interface UnifiedLabReportFormProps {
  labRequest?: LabRequest;
  existingReport?: LabReport;
  onSubmit: (reportData: any) => void;
  onCancel: () => void;
  onSaveDraft?: (reportData: any) => void;
  isLoading?: boolean;
  userRole?: UserRole;
  isReadOnly?: boolean;
  requestId?: string; // Add requestId prop for version history
}

interface UnifiedFormData {
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
}

export default function UnifiedLabReportForm({ 
  labRequest, 
  existingReport, 
  onSubmit, 
  onCancel, 
  onSaveDraft,
  isLoading = false,
  userRole = 'Lab Engineer',
  isReadOnly = false,
  requestId
}: UnifiedLabReportFormProps) {
  const [formData, setFormData] = useState<UnifiedFormData>({
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
    approval_date: existingReport?.approved_at ? new Date(existingReport.approved_at) : undefined
  });

  const [activeTab, setActiveTab] = useState('general');
  const [currentVersion, setCurrentVersion] = useState(1);
  const [currentStatus, setCurrentStatus] = useState('draft');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const { toast } = useToast();

  // Update form data when existingReport changes (e.g., after creation)
  useEffect(() => {
    console.log('existingReport changed:', existingReport);
    if (existingReport) {
      console.log('Updating formData with existingReport:', {
        report_id: existingReport.report_id,
        id: existingReport.id,
        current_lab_report_id: formData.lab_report_id
      });
      
      setFormData(prev => {
        const updated = {
          ...prev,
          lab_report_id: existingReport.report_id || existingReport.id || prev.lab_report_id,
          lab_request_id: existingReport.request_id || existingReport.assignment_id || requestId || prev.lab_request_id,
          project_name: existingReport.project_name || prev.project_name,
          borehole_no: existingReport.borehole_no || existingReport.sample_id || prev.borehole_no,
          client: existingReport.client || prev.client,
          date: existingReport.test_date ? new Date(existingReport.test_date) : prev.date,
          tested_by: existingReport.tested_by || prev.tested_by,
          checked_by: existingReport.checked_by || prev.checked_by,
          approved_by: existingReport.approved_by || prev.approved_by,
          report_status: existingReport.status || prev.report_status,
          soil_test_data: existingReport.soil_test_data || prev.soil_test_data,
          rock_test_data: existingReport.rock_test_data || prev.rock_test_data,
          soil_test_completed: existingReport.soil_test_data && existingReport.soil_test_data.length > 0,
          rock_test_completed: existingReport.rock_test_data && existingReport.rock_test_data.length > 0
        };
        
        console.log('Updated formData:', updated);
        return updated;
      });
    }
  }, [existingReport]);

  const handleSoilFormSubmit = (soilData: any) => {
    setFormData(prev => ({
      ...prev,
      soil_test_data: soilData.soil_test_data || [],
      soil_test_completed: true
    }));
    toast({
      title: 'Soil Test Data Saved',
      description: 'Soil test data has been saved successfully.',
    });
  };

  const handleRockFormSubmit = (rockData: any) => {
    setFormData(prev => ({
      ...prev,
      rock_test_data: rockData.rock_test_data || [],
      rock_test_completed: true
    }));
    toast({
      title: 'Rock Test Data Saved',
      description: 'Rock test data has been saved successfully.',
    });
  };



  const handleExportToExcel = () => {
    if (!formData.soil_test_completed && !formData.rock_test_completed) {
      toast({
        variant: 'destructive',
        title: 'Export Error',
        description: 'Please complete at least one test type before exporting.',
      });
      return;
    }

    const exportData: UnifiedLabReportData = {
      lab_report_id: formData.lab_report_id || '',
      project_name: formData.project_name,
      borehole_no: formData.borehole_no,
      client: formData.client,
      date: formData.date,
      tested_by: formData.tested_by,
      checked_by: formData.checked_by,
      approved_by: formData.approved_by,
      test_types: [
        ...(formData.soil_test_completed ? ['Soil'] : []),
        ...(formData.rock_test_completed ? ['Rock'] : [])
      ],
      combined_data: {
        soil: formData.soil_test_data,
        rock: formData.rock_test_data
      }
    };

    try {
      const filename = exportUnifiedLabReportToExcel(exportData);
      toast({
        title: 'Export Successful',
        description: `Lab report exported to ${filename}`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export Error',
        description: 'Failed to export lab report. Please try again.',
      });
    }
  };

  const getCompletionStatus = () => {
    const totalTests = 2; // Soil + Rock
    const completedTests = [formData.soil_test_completed, formData.rock_test_completed].filter(Boolean).length;
    return { completed: completedTests, total: totalTests, percentage: (completedTests / totalTests) * 100 };
  };

  const completionStatus = getCompletionStatus();

  const loadVersionHistory = async () => {
    console.log('loadVersionHistory called with formData:', formData);
    console.log('lab_report_id:', formData.lab_report_id);
    console.log('isValidUUID:', isValidUUID(formData.lab_report_id));
    
    if (!formData.lab_report_id || !isValidUUID(formData.lab_report_id)) {
      console.log('No valid report ID available for version history');
      return;
    }

    setLoadingVersions(true);
    try {
      console.log('Making API call to get version history for report ID:', formData.lab_report_id);
      const response = await labReportVersionControlApi.getVersionHistory(formData.lab_report_id);
      console.log('Version history API response:', response);
      
      if (response.data?.success) {
        setVersions(response.data.data?.versions || []);
        setShowVersionHistory(true);
        console.log('Versions set:', response.data.data?.versions);
      } else {
        console.error('API returned error:', response.data);
        toast({
          title: 'Error',
          description: response.data?.message || 'Failed to load version history',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading version history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load version history',
        variant: 'destructive',
      });
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleVersionHistoryClick = () => {
    if (showVersionHistory) {
      setShowVersionHistory(false);
    } else {
      loadVersionHistory();
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons - Moved to Top */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div className="flex gap-2 items-center">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              {formData.lab_report_id && isValidUUID(formData.lab_report_id) && (
                <Badge variant={formData.report_status === 'Approved' ? 'default' : 'secondary'}>
                  {formData.report_status}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              {/* Main Form Actions */}
              {!isReadOnly && (
                <>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      // Call the onSaveDraft prop if available, otherwise use onSubmit with draft status
                      if (onSaveDraft) {
                        onSaveDraft(formData);
                      } else {
                        onSubmit({ ...formData, status: 'draft' });
                      }
                    }}
                    disabled={isLoading}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Draft
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      // Call onSubmit with submitted status
                      onSubmit({ ...formData, status: 'submitted' });
                    }}
                    disabled={isLoading}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Submit for Review
                  </Button>
                </>
              )}
              
                             {/* Version History Button - Only show when there's a valid report ID */}
              {formData.lab_report_id && isValidUUID(formData.lab_report_id) && (
                <Button 
                  variant="outline"
                  onClick={handleVersionHistoryClick}
                  disabled={loadingVersions}
                >
                  <History className="h-4 w-4 mr-2" />
                  {loadingVersions ? 'Loading...' : showVersionHistory ? 'Hide History' : 'Version History'}
                </Button>
              )}
              
              <Button 
                variant="outline"
                onClick={handleExportToExcel}
                disabled={!formData.soil_test_completed && !formData.rock_test_completed}
              >
                <Download className="h-4 w-4 mr-2" />
                Export to Excel
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  // Preview functionality
                  toast({
                    title: 'Preview',
                    description: 'Preview functionality will be implemented here.',
                  });
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Report
              </Button>
            </div>
          </div>
        </CardContent>
             </Card>

       {/* Version History Section */}
       {showVersionHistory && (
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <History className="h-5 w-5" />
               Version History
             </CardTitle>
           </CardHeader>
           <CardContent>
             {versions.length === 0 ? (
               <div className="text-center py-8 text-gray-500">
                 <FileText className="h-12 w-12 mx-auto mb-4" />
                 <p>No versions found</p>
                 <p className="text-sm">Save a draft to create your first version</p>
               </div>
             ) : (
               <div className="space-y-4">
                 {versions.map((version) => (
                   <div key={version.version_no} className="border rounded-lg p-4">
                     <div className="flex items-center justify-between mb-2">
                       <div className="flex items-center gap-2">
                         <Badge variant="outline">Version {version.version_no}</Badge>
                         <Badge 
                           variant={
                             version.status === 'approved' ? 'default' : 
                             version.status === 'rejected' ? 'destructive' : 
                             version.status === 'submitted' ? 'secondary' : 'outline'
                           }
                         >
                           {version.status}
                         </Badge>
                         {version.version_no === currentVersion && (
                           <Badge variant="secondary">Current</Badge>
                         )}
                       </div>
                       <div className="text-sm text-gray-500">
                         {new Date(version.created_at).toLocaleString()}
                       </div>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-2">
                       <div className="flex items-center gap-2">
                         <span className="font-medium">Created by:</span>
                         {version.created_by_name || 'Unknown'}
                       </div>
                       <div className="flex items-center gap-2">
                         <span className="font-medium">Test Types:</span>
                         {version.test_types?.join(', ') || 'None'}
                       </div>
                     </div>

                     {/* Status-specific timestamps */}
                     {version.submitted_at && (
                       <div className="text-sm text-blue-600">
                         Submitted: {new Date(version.submitted_at).toLocaleString()}
                       </div>
                     )}
                     {version.approved_at && (
                       <div className="text-sm text-green-600">
                         Approved: {new Date(version.approved_at).toLocaleString()}
                       </div>
                     )}
                     {version.rejected_at && (
                       <div className="text-sm text-red-600">
                         Rejected: {new Date(version.rejected_at).toLocaleString()}
                       </div>
                     )}
                     {version.returned_at && (
                       <div className="text-sm text-orange-600">
                         Returned: {new Date(version.returned_at).toLocaleString()}
                       </div>
                     )}

                     {/* Comments */}
                     {(version.review_comments || version.rejection_reason || version.comments?.length > 0) && (
                       <div className="mt-3 pt-3 border-t">
                         <div className="flex items-center gap-2 mb-2">
                           <span className="font-medium">Comments</span>
                         </div>
                         <div className="space-y-2">
                           {version.review_comments && (
                             <div className="text-sm bg-gray-50 p-2 rounded">
                               {version.review_comments}
                             </div>
                           )}
                           {version.rejection_reason && (
                             <div className="text-sm bg-red-50 p-2 rounded text-red-700">
                               <strong>Rejection Reason:</strong> {version.rejection_reason}
                             </div>
                           )}
                           {version.comments?.map((comment: any, index: number) => (
                             <div key={index} className="text-sm bg-blue-50 p-2 rounded">
                               <div className="font-medium">{comment.comment_type?.replace('_', ' ').toUpperCase()}</div>
                               <div>{comment.comment_text}</div>
                               <div className="text-xs text-gray-500 mt-1">
                                 {comment.commented_by} - {new Date(comment.commented_at).toLocaleString()}
                               </div>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                 ))}
               </div>
             )}
           </CardContent>
         </Card>
       )}

       {/* Progress Indicator */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Test Completion Progress</h3>
            <Badge variant={completionStatus.percentage === 100 ? 'default' : 'secondary'}>
              {completionStatus.completed}/{completionStatus.total} Tests Complete
            </Badge>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                formData.soil_test_completed 
                  ? 'bg-green-100 text-green-600' 
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {formData.soil_test_completed ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <FlaskConical className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium">Soil Tests</p>
                <p className="text-sm text-muted-foreground">
                  {formData.soil_test_completed ? 'Completed' : 'Pending'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                formData.rock_test_completed 
                  ? 'bg-green-100 text-green-600' 
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {formData.rock_test_completed ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <Mountain className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium">Rock Tests</p>
                <p className="text-sm text-muted-foreground">
                  {formData.rock_test_completed ? 'Completed' : 'Pending'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Form Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General Info</TabsTrigger>
              <TabsTrigger value="soil">Soil Tests</TabsTrigger>
              <TabsTrigger value="rock">Rock Tests</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Report Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Report ID</label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formData.lab_report_id ? 
                          (isValidUUID(formData.lab_report_id) ? 
                            formData.lab_report_id : 
                            'Will be assigned after saving'
                          ) : 
                          'Not assigned yet'
                        }
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Status</label>
                      <p className="text-sm text-muted-foreground mt-1">{formData.report_status}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Date</label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formData.date ? new Date(formData.date).toLocaleDateString() : 'Not set'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Tested By</label>
                      <p className="text-sm text-muted-foreground mt-1">{formData.tested_by}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Checked By</label>
                      <p className="text-sm text-muted-foreground mt-1">{formData.checked_by}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Approved By</label>
                      <p className="text-sm text-muted-foreground mt-1">{formData.approved_by}</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="soil" className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <FlaskConical className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-medium">Soil Laboratory Tests</h3>
                {formData.soil_test_completed && (
                  <Badge variant="default" className="bg-green-100 text-green-700">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Completed
                  </Badge>
                )}
              </div>
              <SoilLabReportForm
                labRequest={labRequest}
                existingReport={existingReport}
                onSubmit={handleSoilFormSubmit}
                onCancel={() => {}}
                onSaveDraft={() => {}}
                isLoading={false}
                userRole={userRole}
                isReadOnly={isReadOnly}
              />
            </TabsContent>

            <TabsContent value="rock" className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Mountain className="h-5 w-5 text-orange-600" />
                <h3 className="text-lg font-medium">Rock Laboratory Tests</h3>
                {formData.rock_test_completed && (
                  <Badge variant="default" className="bg-orange-100 text-orange-700">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Completed
                  </Badge>
                )}
              </div>
              <RockLabReportForm
                labRequest={labRequest}
                existingReport={existingReport}
                onSubmit={handleRockFormSubmit}
                onCancel={() => {}}
                onSaveDraft={() => {}}
                isLoading={false}
                userRole={userRole}
                isReadOnly={isReadOnly}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>


    </div>
  );
}
