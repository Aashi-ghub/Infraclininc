import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CalendarIcon, FlaskConical, FileText, Upload, Save, Send, Eye, Download, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { LabRequest, LabReport, UserRole } from '@/lib/types';

interface LabReportFormProps {
  labRequest?: LabRequest;
  existingReport?: LabReport;
  onSubmit: (reportData: any) => void;
  onCancel: () => void;
  onSaveDraft?: (reportData: any) => void;
  isLoading?: boolean;
  userRole?: UserRole;
  isReadOnly?: boolean;
}

interface FormData {
  // General Info
  lab_report_id?: string;
  lab_request_id: string;
  project_id: string;
  borelog_id: string;
  sample_id: string;
  requested_by: string;
  lab_engineer_name: string;
  date_of_test: Date;
  report_status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';

  // Sample Details
  sample_type: 'Soil' | 'Rock' | 'Water';
  sample_depth: number;
  sample_description: string;
  moisture_condition: 'Dry' | 'Moist' | 'Saturated';

  // Test Details
  test_type: string;
  test_method_standard: string;
  apparatus_used: string;
  technician_notes: string;

  // Test Results
  moisture_content?: number;
  dry_density?: number;
  specific_gravity?: number;
  plastic_limit?: number;
  liquid_limit?: number;
  shrinkage_limit?: number;
  grain_size_distribution?: string;
  permeability?: number;
  shear_strength?: number;
  unconfined_compressive_strength?: number;
  proctor_test_data?: string;
  triaxial_test_data?: string;

  // Attachments
  raw_data_file?: File;
  final_report_file?: File;

  // Review Section
  reviewed_by?: string;
  review_comments?: string;
  approval_status?: 'Approved' | 'Rejected';
  approval_date?: Date;
}

const sampleTypes = [
  { value: 'Soil', label: 'Soil' },
  { value: 'Rock', label: 'Rock' },
  { value: 'Water', label: 'Water' }
];

const moistureConditions = [
  { value: 'Dry', label: 'Dry' },
  { value: 'Moist', label: 'Moist' },
  { value: 'Saturated', label: 'Saturated' }
];

const testTypes = [
  { value: 'Atterberg Limits', label: 'Atterberg Limits' },
  { value: 'Grain Size', label: 'Grain Size' },
  { value: 'Compaction', label: 'Compaction' },
  { value: 'Shear', label: 'Shear' },
  { value: 'Permeability', label: 'Permeability' },
  { value: 'Proctor', label: 'Proctor' },
  { value: 'Tri-axial', label: 'Tri-axial' },
  { value: 'Others', label: 'Others' }
];

const testMethods = [
  { value: 'IS 2720', label: 'IS 2720 (Indian Standard)' },
  { value: 'ASTM D2166', label: 'ASTM D2166 (Compressive Strength)' },
  { value: 'ASTM D422', label: 'ASTM D422 (Grain Size Analysis)' },
  { value: 'ASTM D4318', label: 'ASTM D4318 (Atterberg Limits)' },
  { value: 'BS 1377', label: 'BS 1377 (British Standard)' },
  { value: 'Custom', label: 'Custom Method' }
];

export default function LabReportForm({ 
  labRequest, 
  existingReport, 
  onSubmit, 
  onCancel, 
  onSaveDraft,
  isLoading = false,
  userRole = 'Lab Engineer',
  isReadOnly = false 
}: LabReportFormProps) {
  const [formData, setFormData] = useState<FormData>({
    lab_report_id: existingReport?.id || `LR-${Date.now()}`,
    lab_request_id: labRequest?.id || existingReport?.request_id || '',
    project_id: labRequest?.borelog?.project_name || existingReport?.borelog?.project_name || '',
    borelog_id: labRequest?.borelog_id || existingReport?.borelog_id || '',
    sample_id: labRequest?.sample_id || existingReport?.sample_id || '',
    requested_by: labRequest?.requested_by || existingReport?.submitted_by || '',
    lab_engineer_name: 'Dr. Michael Chen', // This would come from current user
    date_of_test: existingReport?.submitted_at ? new Date(existingReport.submitted_at) : new Date(),
    report_status: existingReport?.status || 'Draft',
    sample_type: 'Soil',
    sample_depth: 0,
    sample_description: '',
    moisture_condition: 'Moist',
    test_type: labRequest?.test_type || '',
    test_method_standard: '',
    apparatus_used: '',
    technician_notes: '',
    reviewed_by: existingReport?.approved_by || '',
    review_comments: existingReport?.rejection_comments || '',
    approval_status: existingReport?.status === 'Approved' ? 'Approved' : 
                    existingReport?.status === 'Rejected' ? 'Rejected' : undefined,
    approval_date: existingReport?.approved_at ? new Date(existingReport.approved_at) : undefined
  });

  const [activeTab, setActiveTab] = useState('general');
  const { toast } = useToast();

  // Auto-fill form data when labRequest changes
  useEffect(() => {
    if (labRequest) {
      setFormData(prev => ({
        ...prev,
        lab_request_id: labRequest.id,
        project_id: labRequest.borelog.project_name,
        borelog_id: labRequest.borelog_id,
        sample_id: labRequest.sample_id,
        requested_by: labRequest.requested_by,
        test_type: labRequest.test_type
      }));
    }
  }, [labRequest]);

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.sample_id || !formData.test_type) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill in all required fields',
      });
      return;
    }

    onSubmit(formData);
  };

  const handleSaveDraft = () => {
    if (onSaveDraft) {
      onSaveDraft({ ...formData, report_status: 'Draft' });
    }
  };

  const getTestResultFields = () => {
    switch (formData.test_type) {
      case 'Atterberg Limits':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="plastic_limit">Plastic Limit (%)</Label>
              <Input
                id="plastic_limit"
                type="number"
                step="0.01"
                value={formData.plastic_limit || ''}
                onChange={(e) => handleInputChange('plastic_limit', parseFloat(e.target.value))}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label htmlFor="liquid_limit">Liquid Limit (%)</Label>
              <Input
                id="liquid_limit"
                type="number"
                step="0.01"
                value={formData.liquid_limit || ''}
                onChange={(e) => handleInputChange('liquid_limit', parseFloat(e.target.value))}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label htmlFor="shrinkage_limit">Shrinkage Limit (%)</Label>
              <Input
                id="shrinkage_limit"
                type="number"
                step="0.01"
                value={formData.shrinkage_limit || ''}
                onChange={(e) => handleInputChange('shrinkage_limit', parseFloat(e.target.value))}
                disabled={isReadOnly}
              />
            </div>
          </div>
        );

      case 'Grain Size':
        return (
          <div>
            <Label htmlFor="grain_size_distribution">Grain Size Distribution Data</Label>
            <Textarea
              id="grain_size_distribution"
              placeholder="Enter grain size distribution data or upload file..."
              value={formData.grain_size_distribution || ''}
              onChange={(e) => handleInputChange('grain_size_distribution', e.target.value)}
              rows={4}
              disabled={isReadOnly}
            />
          </div>
        );

      case 'Compaction':
      case 'Proctor':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="moisture_content">Moisture Content (%)</Label>
              <Input
                id="moisture_content"
                type="number"
                step="0.01"
                value={formData.moisture_content || ''}
                onChange={(e) => handleInputChange('moisture_content', parseFloat(e.target.value))}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label htmlFor="dry_density">Dry Density (g/cc)</Label>
              <Input
                id="dry_density"
                type="number"
                step="0.001"
                value={formData.dry_density || ''}
                onChange={(e) => handleInputChange('dry_density', parseFloat(e.target.value))}
                disabled={isReadOnly}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="proctor_test_data">Proctor Test Data (MDD & OMC)</Label>
              <Textarea
                id="proctor_test_data"
                placeholder="Enter Maximum Dry Density (MDD) and Optimum Moisture Content (OMC) data..."
                value={formData.proctor_test_data || ''}
                onChange={(e) => handleInputChange('proctor_test_data', e.target.value)}
                rows={3}
                disabled={isReadOnly}
              />
            </div>
          </div>
        );

      case 'Shear':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shear_strength">Shear Strength (kN/m²)</Label>
              <Input
                id="shear_strength"
                type="number"
                step="0.1"
                value={formData.shear_strength || ''}
                onChange={(e) => handleInputChange('shear_strength', parseFloat(e.target.value))}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label htmlFor="unconfined_compressive_strength">Unconfined Compressive Strength (kN/m²)</Label>
              <Input
                id="unconfined_compressive_strength"
                type="number"
                step="0.1"
                value={formData.unconfined_compressive_strength || ''}
                onChange={(e) => handleInputChange('unconfined_compressive_strength', parseFloat(e.target.value))}
                disabled={isReadOnly}
              />
            </div>
          </div>
        );

      case 'Permeability':
        return (
          <div>
            <Label htmlFor="permeability">Permeability (cm/sec)</Label>
            <Input
              id="permeability"
              type="number"
              step="0.000001"
              value={formData.permeability || ''}
              onChange={(e) => handleInputChange('permeability', parseFloat(e.target.value))}
              disabled={isReadOnly}
            />
          </div>
        );

      case 'Tri-axial':
        return (
          <div>
            <Label htmlFor="triaxial_test_data">Tri-axial Test Data</Label>
            <Textarea
              id="triaxial_test_data"
              placeholder="Enter tri-axial test data or upload file..."
              value={formData.triaxial_test_data || ''}
              onChange={(e) => handleInputChange('triaxial_test_data', e.target.value)}
              rows={4}
              disabled={isReadOnly}
            />
          </div>
        );

      default:
        return (
          <div className="text-center text-muted-foreground py-8">
            <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a test type to see specific result fields</p>
          </div>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-6 w-6" />
                {existingReport ? 'Edit Lab Report' : 'Create Lab Report'}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {existingReport ? `Report ID: ${existingReport.id}` : `Sample: ${formData.sample_id}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={formData.report_status === 'Draft' ? 'secondary' : 
                            formData.report_status === 'Submitted' ? 'default' :
                            formData.report_status === 'Approved' ? 'default' : 'destructive'}>
                {formData.report_status}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="general">General Info</TabsTrigger>
                <TabsTrigger value="sample">Sample Details</TabsTrigger>
                <TabsTrigger value="test">Test Details</TabsTrigger>
                <TabsTrigger value="results">Test Results</TabsTrigger>
                <TabsTrigger value="attachments">Attachments</TabsTrigger>
              </TabsList>

              {/* General Info Tab */}
              <TabsContent value="general" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="lab_report_id">Lab Report ID</Label>
                    <Input
                      id="lab_report_id"
                      value={formData.lab_report_id}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lab_request_id">Lab Request ID</Label>
                    <Input
                      id="lab_request_id"
                      value={formData.lab_request_id}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="project_id">Project ID</Label>
                    <Input
                      id="project_id"
                      value={formData.project_id}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="borelog_id">Borelog ID</Label>
                    <Input
                      id="borelog_id"
                      value={formData.borelog_id}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sample_id">Sample ID</Label>
                    <Input
                      id="sample_id"
                      value={formData.sample_id}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="requested_by">Requested By</Label>
                    <Input
                      id="requested_by"
                      value={formData.requested_by}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lab_engineer_name">Lab Engineer</Label>
                    <Input
                      id="lab_engineer_name"
                      value={formData.lab_engineer_name}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="date_of_test">Date of Test</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          disabled={isReadOnly}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.date_of_test ? format(formData.date_of_test, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.date_of_test}
                          onSelect={(date) => handleInputChange('date_of_test', date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </TabsContent>

              {/* Sample Details Tab */}
              <TabsContent value="sample" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sample_type">Sample Type *</Label>
                    <Select 
                      value={formData.sample_type} 
                      onValueChange={(value) => handleInputChange('sample_type', value)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sampleTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="sample_depth">Sample Depth (m)</Label>
                    <Input
                      id="sample_depth"
                      type="number"
                      step="0.01"
                      value={formData.sample_depth || ''}
                      onChange={(e) => handleInputChange('sample_depth', parseFloat(e.target.value))}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="sample_description">Sample Description</Label>
                    <Textarea
                      id="sample_description"
                      placeholder="Describe the sample characteristics, color, texture, etc."
                      value={formData.sample_description}
                      onChange={(e) => handleInputChange('sample_description', e.target.value)}
                      rows={3}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <Label htmlFor="moisture_condition">Moisture Condition</Label>
                    <Select 
                      value={formData.moisture_condition} 
                      onValueChange={(value) => handleInputChange('moisture_condition', value)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {moistureConditions.map((condition) => (
                          <SelectItem key={condition.value} value={condition.value}>
                            {condition.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* Test Details Tab */}
              <TabsContent value="test" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="test_type">Test Type *</Label>
                    <Select 
                      value={formData.test_type} 
                      onValueChange={(value) => handleInputChange('test_type', value)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select test type" />
                      </SelectTrigger>
                      <SelectContent>
                        {testTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="test_method_standard">Test Method / Standard</Label>
                    <Select 
                      value={formData.test_method_standard} 
                      onValueChange={(value) => handleInputChange('test_method_standard', value)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select test method" />
                      </SelectTrigger>
                      <SelectContent>
                        {testMethods.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="apparatus_used">Apparatus Used</Label>
                    <Input
                      id="apparatus_used"
                      placeholder="List the apparatus and equipment used for testing"
                      value={formData.apparatus_used}
                      onChange={(e) => handleInputChange('apparatus_used', e.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="technician_notes">Technician Notes / Observations</Label>
                    <Textarea
                      id="technician_notes"
                      placeholder="Enter detailed observations, notes, and any special conditions during testing..."
                      value={formData.technician_notes}
                      onChange={(e) => handleInputChange('technician_notes', e.target.value)}
                      rows={4}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Test Results Tab */}
              <TabsContent value="results" className="space-y-4">
                {formData.test_type ? (
                  <div className="space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Test Results for: {formData.test_type}</h4>
                      <p className="text-sm text-muted-foreground">
                        Fill in the specific test results based on the selected test type
                      </p>
                    </div>
                    {getTestResultFields()}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Please select a test type in the Test Details tab to see result fields</p>
                  </div>
                )}
              </TabsContent>

              {/* Attachments Tab */}
              <TabsContent value="attachments" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="raw_data_file">Upload Raw Data File (CSV/Excel)</Label>
                    <Input
                      id="raw_data_file"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => handleInputChange('raw_data_file', e.target.files?.[0])}
                      disabled={isReadOnly}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload raw test data in CSV or Excel format
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="final_report_file">Upload Final Report (PDF)</Label>
                    <Input
                      id="final_report_file"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleInputChange('final_report_file', e.target.files?.[0])}
                      disabled={isReadOnly}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload the final test report in PDF format
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Review Section - Only for Approval Engineers */}
            {userRole === 'Approval Engineer' && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Review Section</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="reviewed_by">Reviewed By</Label>
                    <Input
                      id="reviewed_by"
                      value={formData.reviewed_by || 'Prof. David Wilson'}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="approval_status">Approval Status</Label>
                    <Select 
                      value={formData.approval_status || ''} 
                      onValueChange={(value) => handleInputChange('approval_status', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="approval_date">Approval Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.approval_date ? format(formData.approval_date, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.approval_date}
                          onSelect={(date) => handleInputChange('approval_date', date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="review_comments">Review Comments</Label>
                    <Textarea
                      id="review_comments"
                      placeholder="Enter review comments, feedback, or rejection reasons..."
                      value={formData.review_comments || ''}
                      onChange={(e) => handleInputChange('review_comments', e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <Separator />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              {onSaveDraft && !isReadOnly && (
                <Button type="button" variant="secondary" onClick={handleSaveDraft}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>
              )}
              {!isReadOnly && (
                <Button type="submit" disabled={isLoading}>
                  <Send className="h-4 w-4 mr-2" />
                  {isLoading ? 'Submitting...' : 'Submit Report'}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
