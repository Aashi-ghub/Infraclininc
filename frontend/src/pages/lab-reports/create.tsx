import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { CalendarIcon, FlaskConical, FileText, Upload, Save, Send, Eye, Download, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { ProtectedRoute } from '@/lib/authComponents';
import { LabRequest, LabReport, UserRole } from '@/lib/types';
import { labTestResultsApi } from '@/lib/api';

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

// Mock lab request data - in real app this would come from API
const mockLabRequest: LabRequest = {
  id: 'req-001',
  borelog_id: 'bl-001',
  sample_id: 'SAMPLE-001',
  requested_by: 'John Smith',
  requested_date: '2024-01-15T10:00:00Z',
  status: 'Pending',
  test_type: 'Atterberg Limits',
  priority: 'High',
  due_date: '2024-01-20T17:00:00Z',
  notes: 'Critical for foundation design',
  borelog: {
    borehole_number: 'BH-001',
    project_name: 'Highway Bridge Project',
    chainage: '2.5 km'
  }
};

export default function CreateLabReport() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    lab_report_id: `LR-${Date.now()}`,
    lab_request_id: requestId || '',
    project_id: '',
    borelog_id: '',
    sample_id: '',
    requested_by: '',
    lab_engineer_name: 'Dr. Michael Chen', // This would come from current user
    date_of_test: new Date(),
    report_status: 'Draft',
    sample_type: 'Soil',
    sample_depth: 0,
    sample_description: '',
    moisture_condition: 'Moist',
    test_type: '',
    test_method_standard: '',
    apparatus_used: '',
    technician_notes: '',
  });

  const [activeTab, setActiveTab] = useState('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const { toast } = useToast();

  // Load lab request data
  useEffect(() => {
    if (requestId) {
      // In real app, fetch lab request data from API
      // For now, use mock data
      setFormData(prev => ({
        ...prev,
        lab_request_id: mockLabRequest.id,
        project_id: mockLabRequest.borelog.project_name,
        borelog_id: mockLabRequest.borelog_id,
        sample_id: mockLabRequest.sample_id,
        requested_by: mockLabRequest.requested_by,
        test_type: mockLabRequest.test_type
      }));
    }
  }, [requestId]);

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.sample_id || !formData.test_type) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill in all required fields',
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Prepare the data for the API
      const labTestData = {
        assignment_id: formData.lab_request_id, // Using request ID as assignment ID
        sample_id: formData.sample_id,
        test_type: formData.test_type,
        test_date: formData.date_of_test.toISOString(),
        results: {
          // General Info
          lab_report_id: formData.lab_report_id,
          lab_request_id: formData.lab_request_id,
          project_id: formData.project_id,
          borelog_id: formData.borelog_id,
          requested_by: formData.requested_by,
          lab_engineer_name: formData.lab_engineer_name,
          report_status: formData.report_status,
          
          // Sample Details
          sample_type: formData.sample_type,
          sample_depth: formData.sample_depth,
          sample_description: formData.sample_description,
          moisture_condition: formData.moisture_condition,
          
          // Test Details
          test_method_standard: formData.test_method_standard,
          apparatus_used: formData.apparatus_used,
          technician_notes: formData.technician_notes,
          
          // Test Results
          moisture_content: formData.moisture_content,
          dry_density: formData.dry_density,
          specific_gravity: formData.specific_gravity,
          plastic_limit: formData.plastic_limit,
          liquid_limit: formData.liquid_limit,
          shrinkage_limit: formData.shrinkage_limit,
          grain_size_distribution: formData.grain_size_distribution,
          permeability: formData.permeability,
          shear_strength: formData.shear_strength,
          unconfined_compressive_strength: formData.unconfined_compressive_strength,
          proctor_test_data: formData.proctor_test_data,
          triaxial_test_data: formData.triaxial_test_data,
          
          // Attachments (file names only - actual files would be uploaded separately)
          raw_data_file: formData.raw_data_file?.name,
          final_report_file: formData.final_report_file?.name,
        },
        technician: formData.lab_engineer_name, // This should be the current user's ID
        status: formData.report_status === 'Draft' ? 'draft' : 'submitted',
        remarks: formData.technician_notes
      };

      const response = await labTestResultsApi.create(labTestData);
      
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Lab test result submitted successfully',
        });
        navigate('/lab-reports');
      } else {
        throw new Error(response.message || 'Failed to submit lab test result');
      }
    } catch (error) {
      console.error('Error submitting lab test result:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit lab test result',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    
    try {
      // Prepare the data for the API (same as submit but with draft status)
      const labTestData = {
        assignment_id: formData.lab_request_id,
        sample_id: formData.sample_id,
        test_type: formData.test_type,
        test_date: formData.date_of_test.toISOString(),
        results: {
          // General Info
          lab_report_id: formData.lab_report_id,
          lab_request_id: formData.lab_request_id,
          project_id: formData.project_id,
          borelog_id: formData.borelog_id,
          requested_by: formData.requested_by,
          lab_engineer_name: formData.lab_engineer_name,
          report_status: 'Draft',
          
          // Sample Details
          sample_type: formData.sample_type,
          sample_depth: formData.sample_depth,
          sample_description: formData.sample_description,
          moisture_condition: formData.moisture_condition,
          
          // Test Details
          test_method_standard: formData.test_method_standard,
          apparatus_used: formData.apparatus_used,
          technician_notes: formData.technician_notes,
          
          // Test Results
          moisture_content: formData.moisture_content,
          dry_density: formData.dry_density,
          specific_gravity: formData.specific_gravity,
          plastic_limit: formData.plastic_limit,
          liquid_limit: formData.liquid_limit,
          shrinkage_limit: formData.shrinkage_limit,
          grain_size_distribution: formData.grain_size_distribution,
          permeability: formData.permeability,
          shear_strength: formData.shear_strength,
          unconfined_compressive_strength: formData.unconfined_compressive_strength,
          proctor_test_data: formData.proctor_test_data,
          triaxial_test_data: formData.triaxial_test_data,
          
          // Attachments
          raw_data_file: formData.raw_data_file?.name,
          final_report_file: formData.final_report_file?.name,
        },
        technician: formData.lab_engineer_name,
        status: 'draft',
        remarks: formData.technician_notes
      };

      const response = await labTestResultsApi.create(labTestData);
      
      if (response.success) {
        toast({
          title: 'Draft Saved',
          description: 'Report draft saved successfully',
        });
      } else {
        throw new Error(response.message || 'Failed to save draft');
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save draft',
      });
    } finally {
      setIsSavingDraft(false);
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
    <ProtectedRoute allowedRoles={['Lab Engineer', 'Admin']}>
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/lab-reports')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Lab Reports
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FlaskConical className="h-8 w-8 text-primary" />
              Create Lab Report
            </h1>
            <p className="text-muted-foreground">
              Sample: {formData.sample_id} | Project: {formData.project_id}
            </p>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                1
              </div>
              <span className="text-sm font-medium">General Info</span>
            </div>
            <div className="flex-1 h-px bg-border"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-muted text-muted-foreground rounded-full flex items-center justify-center text-sm font-medium">
                2
              </div>
              <span className="text-sm text-muted-foreground">Sample Details</span>
            </div>
            <div className="flex-1 h-px bg-border"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-muted text-muted-foreground rounded-full flex items-center justify-center text-sm font-medium">
                3
              </div>
              <span className="text-sm text-muted-foreground">Test Details</span>
            </div>
            <div className="flex-1 h-px bg-border"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-muted text-muted-foreground rounded-full flex items-center justify-center text-sm font-medium">
                4
              </div>
              <span className="text-sm text-muted-foreground">Results</span>
            </div>
            <div className="flex-1 h-px bg-border"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-muted text-muted-foreground rounded-full flex items-center justify-center text-sm font-medium">
                5
              </div>
              <span className="text-sm text-muted-foreground">Attachments</span>
            </div>
          </div>
        </div>

        {/* Main Form */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-6 w-6" />
                  Lab Report Form
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Complete all sections to submit your lab report
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
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Request Information</h4>
                    <p className="text-sm text-muted-foreground">
                      This information is automatically filled from the lab request
                    </p>
                  </div>
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
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Sample Information</h4>
                    <p className="text-sm text-muted-foreground">
                      Provide detailed information about the sample being tested
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sample_type">Sample Type *</Label>
                      <Select 
                        value={formData.sample_type} 
                        onValueChange={(value) => handleInputChange('sample_type', value)}
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
                      />
                    </div>
                    <div>
                      <Label htmlFor="moisture_condition">Moisture Condition</Label>
                      <Select 
                        value={formData.moisture_condition} 
                        onValueChange={(value) => handleInputChange('moisture_condition', value)}
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
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Test Configuration</h4>
                    <p className="text-sm text-muted-foreground">
                      Configure the test parameters and methodology
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="test_type">Test Type *</Label>
                      <Select 
                        value={formData.test_type} 
                        onValueChange={(value) => handleInputChange('test_type', value)}
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
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Test Results Tab */}
                <TabsContent value="results" className="space-y-4">
                  {formData.test_type ? (
                    <div className="space-y-6">
                      <div className="bg-orange-50 p-4 rounded-lg">
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
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">File Attachments</h4>
                    <p className="text-sm text-muted-foreground">
                      Upload supporting documents and raw data files
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="raw_data_file">Upload Raw Data File (CSV/Excel)</Label>
                      <Input
                        id="raw_data_file"
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={(e) => handleInputChange('raw_data_file', e.target.files?.[0])}
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
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Upload the final test report in PDF format
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Form Actions */}
              <Separator />
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4" />
                  <span>All required fields must be completed before submission</span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => navigate('/lab-reports')}>
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={handleSaveDraft}
                    disabled={isSavingDraft}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSavingDraft ? 'Saving...' : 'Save Draft'}
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    <Send className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Submitting...' : 'Submit Report'}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
