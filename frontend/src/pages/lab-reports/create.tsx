import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ProtectedRoute } from '@/lib/authComponents';
import { LabRequest } from '@/lib/types';
import { labReportApi } from '@/lib/api';

interface FormData {
  lab_report_id: string;
  lab_request_id: string;
  project_id: string;
  borelog_id: string;
  sample_id: string;
  requested_by: string;
  lab_engineer_name: string;
  date_of_test: Date;
  report_status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  sample_type: 'Soil' | 'Rock' | 'Water';
  sample_depth: number;
  sample_description: string;
  moisture_condition: 'Dry' | 'Moist' | 'Saturated';
  test_type: string;
  test_method_standard: string;
  apparatus_used: string;
  technician_notes: string;
  moisture_content?: number;
  dry_density?: number;
  specific_gravity?: number;
  plastic_limit?: number;
  liquid_limit?: number;
  shrinkage_limit?: number;
  grain_size_distribution?: string;
  permeability?: number;
  shear_strength?: number;
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
  const [labRequest, setLabRequest] = useState<LabRequest | null>(null);
  const [isLoadingRequest, setIsLoadingRequest] = useState(false);
  const { toast } = useToast();

  // Load lab request data
  useEffect(() => {
    if (requestId) {
      loadLabRequest();
    }
  }, [requestId]);

  const loadLabRequest = async () => {
    setIsLoadingRequest(true);
    try {
      const response = await labReportApi.getRequestById(requestId!);
      if (response.data?.success) {
        const requestData = response.data.data;
        setLabRequest(requestData);
        
        // Pre-fill form with request data
        setFormData(prev => ({
          ...prev,
          lab_request_id: requestData.id,
          project_id: requestData.borelog?.project_name || '',
          borelog_id: requestData.borelog_id,
          sample_id: requestData.sample_id,
          requested_by: requestData.requested_by,
          test_type: requestData.test_type
        }));
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
      setIsLoadingRequest(false);
    }
  };

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
        },
        remarks: formData.technician_notes
      };

      await labReportApi.createReport(labTestData);
      
      toast({
        title: 'Success',
        description: 'Lab report created successfully',
      });
      
      navigate('/lab-reports');
    } catch (error: any) {
      console.error('Error creating lab report:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create lab report',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    
    try {
      // Save as draft - similar to submit but with draft status
      const labTestData = {
        assignment_id: formData.lab_request_id,
        sample_id: formData.sample_id,
        test_type: formData.test_type,
        test_date: formData.date_of_test.toISOString(),
        results: {
          lab_report_id: formData.lab_report_id,
          lab_request_id: formData.lab_request_id,
          project_id: formData.project_id,
          borelog_id: formData.borelog_id,
          requested_by: formData.requested_by,
          lab_engineer_name: formData.lab_engineer_name,
          report_status: 'Draft',
          sample_type: formData.sample_type,
          sample_depth: formData.sample_depth,
          sample_description: formData.sample_description,
          moisture_condition: formData.moisture_condition,
          test_method_standard: formData.test_method_standard,
          apparatus_used: formData.apparatus_used,
          technician_notes: formData.technician_notes,
          moisture_content: formData.moisture_content,
          dry_density: formData.dry_density,
          specific_gravity: formData.specific_gravity,
          plastic_limit: formData.plastic_limit,
          liquid_limit: formData.liquid_limit,
          shrinkage_limit: formData.shrinkage_limit,
          grain_size_distribution: formData.grain_size_distribution,
          permeability: formData.permeability,
          shear_strength: formData.shear_strength,
        },
        remarks: formData.technician_notes
      };

      await labReportApi.createReport(labTestData);
      
      toast({
        title: 'Success',
        description: 'Draft saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving draft:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Failed to save draft',
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  if (isLoadingRequest) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading lab request data...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Admin', 'Lab Engineer']}>
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate('/lab-reports')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Lab Report</h1>
            <p className="text-gray-600 mt-2">
              {labRequest ? `Creating report for ${labRequest.sample_id}` : 'Create a new lab report'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">General Info</TabsTrigger>
              <TabsTrigger value="sample">Sample Details</TabsTrigger>
              <TabsTrigger value="test">Test Details</TabsTrigger>
              <TabsTrigger value="results">Test Results</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>General Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lab_report_id">Lab Report ID</Label>
                      <Input
                        id="lab_report_id"
                        value={formData.lab_report_id}
                        onChange={(e) => handleInputChange('lab_report_id', e.target.value)}
                        placeholder="Auto-generated"
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lab_request_id">Lab Request ID</Label>
                      <Input
                        id="lab_request_id"
                        value={formData.lab_request_id}
                        onChange={(e) => handleInputChange('lab_request_id', e.target.value)}
                        placeholder="Request ID"
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="project_id">Project</Label>
                      <Input
                        id="project_id"
                        value={formData.project_id}
                        onChange={(e) => handleInputChange('project_id', e.target.value)}
                        placeholder="Project name"
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="borelog_id">Borelog ID</Label>
                      <Input
                        id="borelog_id"
                        value={formData.borelog_id}
                        onChange={(e) => handleInputChange('borelog_id', e.target.value)}
                        placeholder="Borelog ID"
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sample_id">Sample ID</Label>
                      <Input
                        id="sample_id"
                        value={formData.sample_id}
                        onChange={(e) => handleInputChange('sample_id', e.target.value)}
                        placeholder="Sample ID"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="requested_by">Requested By</Label>
                      <Input
                        id="requested_by"
                        value={formData.requested_by}
                        onChange={(e) => handleInputChange('requested_by', e.target.value)}
                        placeholder="Requested by"
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lab_engineer_name">Lab Engineer</Label>
                      <Input
                        id="lab_engineer_name"
                        value={formData.lab_engineer_name}
                        onChange={(e) => handleInputChange('lab_engineer_name', e.target.value)}
                        placeholder="Lab engineer name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date_of_test">Test Date</Label>
                      <Input
                        id="date_of_test"
                        type="date"
                        value={formData.date_of_test.toISOString().split('T')[0]}
                        onChange={(e) => handleInputChange('date_of_test', new Date(e.target.value))}
                        required
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sample" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Sample Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sample_type">Sample Type</Label>
                      <Select value={formData.sample_type} onValueChange={(value: 'Soil' | 'Rock' | 'Water') => handleInputChange('sample_type', value)}>
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
                    <div className="space-y-2">
                      <Label htmlFor="sample_depth">Sample Depth (m)</Label>
                      <Input
                        id="sample_depth"
                        type="number"
                        step="0.1"
                        value={formData.sample_depth}
                        onChange={(e) => handleInputChange('sample_depth', parseFloat(e.target.value) || 0)}
                        placeholder="Depth in meters"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="moisture_condition">Moisture Condition</Label>
                      <Select value={formData.moisture_condition} onValueChange={(value: 'Dry' | 'Moist' | 'Saturated') => handleInputChange('moisture_condition', value)}>
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
                  <div className="space-y-2">
                    <Label htmlFor="sample_description">Sample Description</Label>
                    <Textarea
                      id="sample_description"
                      value={formData.sample_description}
                      onChange={(e) => handleInputChange('sample_description', e.target.value)}
                      placeholder="Describe the sample appearance, texture, color, etc."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="test" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Test Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="test_type">Test Type</Label>
                      <Select value={formData.test_type} onValueChange={(value) => handleInputChange('test_type', value)}>
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
                    <div className="space-y-2">
                      <Label htmlFor="test_method_standard">Test Method Standard</Label>
                      <Select value={formData.test_method_standard} onValueChange={(value) => handleInputChange('test_method_standard', value)}>
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
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apparatus_used">Apparatus Used</Label>
                    <Input
                      id="apparatus_used"
                      value={formData.apparatus_used}
                      onChange={(e) => handleInputChange('apparatus_used', e.target.value)}
                      placeholder="List the apparatus and equipment used"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="technician_notes">Technician Notes</Label>
                    <Textarea
                      id="technician_notes"
                      value={formData.technician_notes}
                      onChange={(e) => handleInputChange('technician_notes', e.target.value)}
                      placeholder="Any observations, notes, or special conditions during testing"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Test Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="moisture_content">Moisture Content (%)</Label>
                      <Input
                        id="moisture_content"
                        type="number"
                        step="0.01"
                        value={formData.moisture_content || ''}
                        onChange={(e) => handleInputChange('moisture_content', parseFloat(e.target.value) || undefined)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dry_density">Dry Density (g/cm³)</Label>
                      <Input
                        id="dry_density"
                        type="number"
                        step="0.01"
                        value={formData.dry_density || ''}
                        onChange={(e) => handleInputChange('dry_density', parseFloat(e.target.value) || undefined)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="specific_gravity">Specific Gravity</Label>
                      <Input
                        id="specific_gravity"
                        type="number"
                        step="0.001"
                        value={formData.specific_gravity || ''}
                        onChange={(e) => handleInputChange('specific_gravity', parseFloat(e.target.value) || undefined)}
                        placeholder="0.000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="liquid_limit">Liquid Limit (%)</Label>
                      <Input
                        id="liquid_limit"
                        type="number"
                        step="0.1"
                        value={formData.liquid_limit || ''}
                        onChange={(e) => handleInputChange('liquid_limit', parseFloat(e.target.value) || undefined)}
                        placeholder="0.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plastic_limit">Plastic Limit (%)</Label>
                      <Input
                        id="plastic_limit"
                        type="number"
                        step="0.1"
                        value={formData.plastic_limit || ''}
                        onChange={(e) => handleInputChange('plastic_limit', parseFloat(e.target.value) || undefined)}
                        placeholder="0.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shrinkage_limit">Shrinkage Limit (%)</Label>
                      <Input
                        id="shrinkage_limit"
                        type="number"
                        step="0.1"
                        value={formData.shrinkage_limit || ''}
                        onChange={(e) => handleInputChange('shrinkage_limit', parseFloat(e.target.value) || undefined)}
                        placeholder="0.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="permeability">Permeability (cm/s)</Label>
                      <Input
                        id="permeability"
                        type="number"
                        step="0.000001"
                        value={formData.permeability || ''}
                        onChange={(e) => handleInputChange('permeability', parseFloat(e.target.value) || undefined)}
                        placeholder="0.000000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shear_strength">Shear Strength (kPa)</Label>
                      <Input
                        id="shear_strength"
                        type="number"
                        step="0.1"
                        value={formData.shear_strength || ''}
                        onChange={(e) => handleInputChange('shear_strength', parseFloat(e.target.value) || undefined)}
                        placeholder="0.0"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grain_size_distribution">Grain Size Distribution</Label>
                    <Textarea
                      id="grain_size_distribution"
                      value={formData.grain_size_distribution || ''}
                      onChange={(e) => handleInputChange('grain_size_distribution', e.target.value)}
                      placeholder="Describe grain size distribution or paste sieve analysis results"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => navigate('/lab-reports')}>
              Cancel
            </Button>
            <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isSavingDraft}>
              {isSavingDraft ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Report'}
            </Button>
          </div>
        </form>
      </div>
    </ProtectedRoute>
  );
}
