import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Save, Send, Download, Eye, FlaskConical, Mountain, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LabRequest, LabReport, UserRole } from '@/lib/types';
import SoilLabReportForm from './SoilLabReportForm';
import RockLabReportForm from './RockLabReportForm';
import { exportUnifiedLabReportToExcel, UnifiedLabReportData } from '@/lib/labReportExporter';

interface UnifiedLabReportFormProps {
  labRequest?: LabRequest;
  existingReport?: LabReport;
  onSubmit: (reportData: any) => void;
  onCancel: () => void;
  onSaveDraft?: (reportData: any) => void;
  isLoading?: boolean;
  userRole?: UserRole;
  isReadOnly?: boolean;
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
  isReadOnly = false 
}: UnifiedLabReportFormProps) {
  const [formData, setFormData] = useState<UnifiedFormData>({
    lab_report_id: existingReport?.id || `ULR-${Date.now()}`,
    lab_request_id: labRequest?.id || existingReport?.request_id || '',
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
  const { toast } = useToast();

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

  const handleSubmit = async () => {
    if (!formData.soil_test_completed && !formData.rock_test_completed) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please complete at least one test type (Soil or Rock) before submitting.',
      });
      return;
    }

    const unifiedReportData: UnifiedLabReportData = {
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

    onSubmit(unifiedReportData);
  };

  const handleSaveDraft = () => {
    const draftData: UnifiedLabReportData = {
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

    if (onSaveDraft) {
      onSaveDraft(draftData);
    }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Unified Lab Report Form
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Complete both soil and rock tests for comprehensive borelog analysis
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={formData.report_status === 'Draft' ? 'secondary' : 'default'}>
                {formData.report_status}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium">Project</p>
              <p className="text-sm text-muted-foreground">{formData.project_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Borehole</p>
              <p className="text-sm text-muted-foreground">{formData.borehole_no}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Report ID</p>
              <p className="text-sm text-muted-foreground">{formData.lab_report_id}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Project Information</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Project Name</label>
                      <p className="text-sm text-muted-foreground mt-1">{formData.project_name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Borehole Number</label>
                      <p className="text-sm text-muted-foreground mt-1">{formData.borehole_no}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Client</label>
                      <p className="text-sm text-muted-foreground mt-1">{formData.client || 'Not specified'}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Report Details</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Report ID</label>
                      <p className="text-sm text-muted-foreground mt-1">{formData.lab_report_id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Tested By</label>
                      <p className="text-sm text-muted-foreground mt-1">{formData.tested_by}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Date</label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formData.date.toLocaleDateString()}
                      </p>
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

      {/* Action Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSaveDraft}
                disabled={!formData.soil_test_completed && !formData.rock_test_completed}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
            </div>
            <div className="flex gap-2">
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
              <Button 
                onClick={handleSubmit}
                disabled={isLoading || (!formData.soil_test_completed && !formData.rock_test_completed)}
              >
                <Send className="h-4 w-4 mr-2" />
                Submit Combined Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
