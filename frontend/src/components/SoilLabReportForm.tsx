import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { LabRequest, LabReport, UserRole } from '@/lib/types';

interface SoilLabReportFormProps {
  labRequest?: LabRequest;
  existingReport?: LabReport;
  onSubmit: (reportData: any) => void;
  onCancel: () => void;
  onSaveDraft?: (reportData: any) => void;
  isLoading?: boolean;
  userRole?: UserRole;
  isReadOnly?: boolean;
}

interface SoilTestData {
  sample_no: string;
  sample_depth: number;
  observed_n_value?: number;
  corrected_n_value?: number;
  soil_type: string;
  soil_classification: string;
  moisture_content: number;
  bulk_density: number;
  dry_density: number;
  specific_gravity: number;
  gravel_percent: number;
  sand_percent: number;
  silt_percent: number;
  clay_percent: number;
  liquid_limit: number;
  plastic_limit: number;
  plasticity_index: number;
  shrinkage_limit: number;
  permeability: number;
  free_swell_index: number;
  swelling_pressure: number;
  shear_test_type: string;
  cohesion: number;
  angle_of_shearing_resistance: number;
  unconfined_compressive_strength: number;
  initial_void_ratio: number;
  compression_index: number;
  pre_consolidation_pressure: number;
}

interface FormData {
  lab_report_id?: string;
  lab_request_id: string;
  project_name: string;
  client_name: string;
  loa_number: string;
  job_code: string;
  coordinates_e: number;
  coordinates_n: number;
  section_name: string;
  location: string;
  chainage_km: number;
  borehole_no: string;
  standing_water_level: number;
  date: Date;
  tested_by: string;
  checked_by: string;
  approved_by: string;
  report_status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  soil_test_data: SoilTestData[];
  test_summary: {
    nmc_count: number;
    dry_density_count: number;
    liquid_limit_count: number;
    plastic_limit_count: number;
    shrinkage_limit_count: number;
    specific_gravity_count: number;
    sieve_analysis_count: number;
    hydrometer_test_count: number;
    direct_shear_test_count: number;
    natural_density_count: number;
    consolidation_test_count: number;
    ucs_count: number;
    triaxial_test_count: number;
  };
  reviewed_by?: string;
  review_comments?: string;
  approval_status?: 'Approved' | 'Rejected';
  approval_date?: Date;
}

const soilTypes = [
  { value: 'D', label: 'Disturbed Sample' },
  { value: 'U', label: 'Undisturbed Sample' },
  { value: 'S', label: 'SPT Sample' }
];

const shearTestTypes = [
  { value: 'TR-UU', label: 'Triaxial Unconsolidated Undrained' },
  { value: 'TR-CU', label: 'Triaxial Consolidated Undrained' },
  { value: 'TR-CD', label: 'Triaxial Consolidated Drained' },
  { value: 'DS-UU', label: 'Direct Shear Unconsolidated Undrained' },
  { value: 'DS-CU', label: 'Direct Shear Consolidated Undrained' },
  { value: 'DS-CD', label: 'Direct Shear Consolidated Drained' }
];

export default function SoilLabReportForm({ 
  labRequest, 
  existingReport, 
  onSubmit, 
  onCancel, 
  onSaveDraft,
  isLoading = false,
  userRole = 'Lab Engineer',
  isReadOnly = false 
}: SoilLabReportFormProps) {
  const [formData, setFormData] = useState<FormData>({
    lab_report_id: existingReport?.id || `SLR-${Date.now()}`,
    lab_request_id: labRequest?.id || existingReport?.request_id || '',
    project_name: labRequest?.borelog?.project_name || existingReport?.borelog?.project_name || '',
    client_name: '',
    loa_number: '',
    job_code: '',
    coordinates_e: 0,
    coordinates_n: 0,
    section_name: '',
    location: '',
    chainage_km: 0,
    borehole_no: labRequest?.sample_id || existingReport?.sample_id || '',
    standing_water_level: 0,
    date: existingReport?.submitted_at ? new Date(existingReport.submitted_at) : new Date(),
    tested_by: 'Dr. Michael Chen',
    checked_by: 'Prof. Sarah Johnson',
    approved_by: 'Prof. David Wilson',
    report_status: (existingReport?.status as 'Draft' | 'Submitted' | 'Approved' | 'Rejected') || 'Draft',
    soil_test_data: (existingReport as any)?.soil_test_data || [],
    test_summary: {
      nmc_count: 0,
      dry_density_count: 0,
      liquid_limit_count: 0,
      plastic_limit_count: 0,
      shrinkage_limit_count: 0,
      specific_gravity_count: 0,
      sieve_analysis_count: 0,
      hydrometer_test_count: 0,
      direct_shear_test_count: 0,
      natural_density_count: 0,
      consolidation_test_count: 0,
      ucs_count: 0,
      triaxial_test_count: 0
    },
    reviewed_by: existingReport?.approved_by || '',
    review_comments: existingReport?.rejection_comments || '',
    approval_status: existingReport?.status === 'Approved' ? 'Approved' : 
                    existingReport?.status === 'Rejected' ? 'Rejected' : undefined,
    approval_date: existingReport?.approved_at ? new Date(existingReport.approved_at) : undefined
  });

  const { toast } = useToast();

  useEffect(() => {
    if (labRequest) {
      setFormData(prev => ({
        ...prev,
        lab_request_id: labRequest.id,
        project_name: labRequest.borelog.project_name,
        borehole_no: labRequest.sample_id
      }));
    }
  }, [labRequest]);

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTestDataChange = (index: number, field: keyof SoilTestData, value: any) => {
    setFormData(prev => ({
      ...prev,
      soil_test_data: prev.soil_test_data.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  // Helper function to safely parse float values
  const safeParseFloat = (value: string): number => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Helper function to safely parse integer values
  const safeParseInt = (value: string): number => {
    const parsed = parseInt(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  const addTestDataRow = () => {
    const newRow: SoilTestData = {
      sample_no: `Sample ${formData.soil_test_data.length + 1}`,
      sample_depth: 0.50 + (formData.soil_test_data.length * 0.50),
      observed_n_value: undefined,
      corrected_n_value: undefined,
      soil_type: 'D',
      soil_classification: '',
      moisture_content: 0,
      bulk_density: 0,
      dry_density: 0,
      specific_gravity: 0,
      gravel_percent: 0,
      sand_percent: 0,
      silt_percent: 0,
      clay_percent: 0,
      liquid_limit: 0,
      plastic_limit: 0,
      plasticity_index: 0,
      shrinkage_limit: 0,
      permeability: 0,
      free_swell_index: 0,
      swelling_pressure: 0,
      shear_test_type: 'TR-UU',
      cohesion: 0,
      angle_of_shearing_resistance: 0,
      unconfined_compressive_strength: 0,
      initial_void_ratio: 0,
      compression_index: 0,
      pre_consolidation_pressure: 0
    };
    setFormData(prev => ({
      ...prev,
      soil_test_data: [...prev.soil_test_data, newRow]
    }));
  };

  const removeTestDataRow = (index: number) => {
    setFormData(prev => ({
      ...prev,
      soil_test_data: prev.soil_test_data.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // This function is now handled by the parent component's version control
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Laboratory Soil Tests Result Summary Sheet</h1>
          <p className="text-muted-foreground">BPC Consultant INDIA Pvt. Ltd.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>

      {/* Project Information */}
      <Card>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="project_name">Project Name</Label>
            <Textarea
              id="project_name"
              value={formData.project_name}
              onChange={(e) => handleInputChange('project_name', e.target.value)}
              disabled={isReadOnly}
              placeholder="Enter project name"
            />
          </div>
          <div>
            <Label htmlFor="client_name">Client Name</Label>
            <Input
              id="client_name"
              value={formData.client_name}
              onChange={(e) => handleInputChange('client_name', e.target.value)}
              disabled={isReadOnly}
              placeholder="Enter client name"
            />
          </div>
          <div>
            <Label htmlFor="loa_number">LOA Number</Label>
            <Input
              id="loa_number"
              value={formData.loa_number}
              onChange={(e) => handleInputChange('loa_number', e.target.value)}
              disabled={isReadOnly}
              placeholder="Enter LOA number"
            />
          </div>
          <div>
            <Label htmlFor="job_code">Job Code</Label>
            <Input
              id="job_code"
              value={formData.job_code}
              onChange={(e) => handleInputChange('job_code', e.target.value)}
              disabled={isReadOnly}
              placeholder="Enter job code"
            />
          </div>
        </CardContent>
      </Card>

      {/* Location Details */}
      <Card>
        <CardHeader>
          <CardTitle>Location Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="coordinates_e">Coordinates E</Label>
            <Input
              id="coordinates_e"
              type="number"
              step="0.001"
              value={formData.coordinates_e}
              onChange={(e) => handleInputChange('coordinates_e', safeParseFloat(e.target.value))}
              disabled={isReadOnly}
              placeholder="E.g., 529303.065"
            />
          </div>
          <div>
            <Label htmlFor="coordinates_n">Coordinates N</Label>
            <Input
              id="coordinates_n"
              type="number"
              step="0.001"
              value={formData.coordinates_n}
              onChange={(e) => handleInputChange('coordinates_n', safeParseFloat(e.target.value))}
              disabled={isReadOnly}
              placeholder="E.g., 2469991.452"
            />
          </div>
          <div>
            <Label htmlFor="section_name">Section Name</Label>
            <Input
              id="section_name"
              value={formData.section_name}
              onChange={(e) => handleInputChange('section_name', e.target.value)}
              disabled={isReadOnly}
              placeholder="E.g., KGP - TATA"
            />
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              disabled={isReadOnly}
              placeholder="E.g., NEW MNBR"
            />
          </div>
          <div>
            <Label htmlFor="chainage_km">Chainage (km)</Label>
            <Input
              id="chainage_km"
              type="number"
              step="0.001"
              value={formData.chainage_km}
              onChange={(e) => handleInputChange('chainage_km', safeParseFloat(e.target.value))}
              disabled={isReadOnly}
              placeholder="E.g., 2325"
            />
          </div>
          <div>
            <Label htmlFor="borehole_no">Borehole No.</Label>
            <Input
              id="borehole_no"
              value={formData.borehole_no}
              onChange={(e) => handleInputChange('borehole_no', e.target.value)}
              disabled={isReadOnly}
              placeholder="E.g., BH-1"
            />
          </div>
          <div>
            <Label htmlFor="standing_water_level">Standing Water Level (m BGL)</Label>
            <Input
              id="standing_water_level"
              type="number"
              step="0.01"
              value={formData.standing_water_level}
              onChange={(e) => handleInputChange('standing_water_level', safeParseFloat(e.target.value))}
              disabled={isReadOnly}
              placeholder="E.g., 1.20"
            />
          </div>
        </CardContent>
      </Card>

      {/* Report Details */}
      <Card>
        <CardHeader>
          <CardTitle>Report Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="date">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal" disabled={isReadOnly}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.date ? format(formData.date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.date}
                  onSelect={(date) => handleInputChange('date', date)}
                  disabled={isReadOnly}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label htmlFor="tested_by">Tested By</Label>
            <Input
              id="tested_by"
              value={formData.tested_by}
              onChange={(e) => handleInputChange('tested_by', e.target.value)}
              disabled={isReadOnly}
              placeholder="Enter tester name"
            />
          </div>
          <div>
            <Label htmlFor="checked_by">Checked By</Label>
            <Input
              id="checked_by"
              value={formData.checked_by}
              onChange={(e) => handleInputChange('checked_by', e.target.value)}
              disabled={isReadOnly}
              placeholder="Enter checker name"
            />
          </div>
          <div>
            <Label htmlFor="approved_by">Approved By</Label>
            <Input
              id="approved_by"
              value={formData.approved_by}
              onChange={(e) => handleInputChange('approved_by', e.target.value)}
              disabled={isReadOnly}
              placeholder="Enter approver name"
            />
          </div>
        </CardContent>
      </Card>

      {/* Soil Test Data */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Soil Test Data</CardTitle>
            {!isReadOnly && (
              <Button onClick={addTestDataRow} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Sample
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sample No.</TableHead>
                  <TableHead>Depth (m)</TableHead>
                  <TableHead>Observed N Value</TableHead>
                  <TableHead>Corrected N Value</TableHead>
                  <TableHead>Soil Type</TableHead>
                  <TableHead>Soil Classification</TableHead>
                  <TableHead>Moisture Content (%)</TableHead>
                  <TableHead>Bulk Density (g/cc)</TableHead>
                  <TableHead>Dry Density (g/cc)</TableHead>
                  <TableHead>Sp. Gravity</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formData.soil_test_data.map((sample, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Input
                        value={sample.sample_no}
                        onChange={(e) => handleTestDataChange(index, 'sample_no', e.target.value)}
                        disabled={isReadOnly}
                        placeholder="Sample No."
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={sample.sample_depth}
                        onChange={(e) => handleTestDataChange(index, 'sample_depth', safeParseFloat(e.target.value))}
                        disabled={isReadOnly}
                        placeholder="Depth"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="1"
                        value={sample.observed_n_value || ''}
                        onChange={(e) => handleTestDataChange(index, 'observed_n_value', safeParseFloat(e.target.value))}
                        disabled={isReadOnly}
                        placeholder="N Value"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="1"
                        value={sample.corrected_n_value || ''}
                        onChange={(e) => handleTestDataChange(index, 'corrected_n_value', safeParseFloat(e.target.value))}
                        disabled={isReadOnly}
                        placeholder="N Value"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={sample.soil_type}
                        onValueChange={(value) => handleTestDataChange(index, 'soil_type', value)}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {soilTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={sample.soil_classification}
                        onChange={(e) => handleTestDataChange(index, 'soil_classification', e.target.value)}
                        disabled={isReadOnly}
                        placeholder="e.g., CI (12.25)"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={sample.moisture_content}
                        onChange={(e) => handleTestDataChange(index, 'moisture_content', safeParseFloat(e.target.value))}
                        disabled={isReadOnly}
                        placeholder="MC %"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.001"
                        value={sample.bulk_density}
                        onChange={(e) => handleTestDataChange(index, 'bulk_density', safeParseFloat(e.target.value))}
                        disabled={isReadOnly}
                        placeholder="γb"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.001"
                        value={sample.dry_density}
                        onChange={(e) => handleTestDataChange(index, 'dry_density', safeParseFloat(e.target.value))}
                        disabled={isReadOnly}
                        placeholder="γd"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={sample.specific_gravity}
                        onChange={(e) => handleTestDataChange(index, 'specific_gravity', safeParseFloat(e.target.value))}
                        disabled={isReadOnly}
                        placeholder="G"
                      />
                    </TableCell>
                    <TableCell>
                      {!isReadOnly && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeTestDataRow(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Test Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Test Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>NMC (%)</Label>
              <Input
                type="number"
                value={formData.test_summary.nmc_count}
                onChange={(e) => handleInputChange('test_summary', {
                  ...formData.test_summary,
                  nmc_count: safeParseInt(e.target.value)
                })}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>Dry Density</Label>
              <Input
                type="number"
                value={formData.test_summary.dry_density_count}
                onChange={(e) => handleInputChange('test_summary', {
                  ...formData.test_summary,
                  dry_density_count: safeParseInt(e.target.value)
                })}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>Liquid Limit</Label>
              <Input
                type="number"
                value={formData.test_summary.liquid_limit_count}
                onChange={(e) => handleInputChange('test_summary', {
                  ...formData.test_summary,
                  liquid_limit_count: safeParseInt(e.target.value)
                })}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>Plastic Limit</Label>
              <Input
                type="number"
                value={formData.test_summary.plastic_limit_count}
                onChange={(e) => handleInputChange('test_summary', {
                  ...formData.test_summary,
                  plastic_limit_count: safeParseInt(e.target.value)
                })}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>Shrinkage Limit</Label>
              <Input
                type="number"
                value={formData.test_summary.shrinkage_limit_count}
                onChange={(e) => handleInputChange('test_summary', {
                  ...formData.test_summary,
                  shrinkage_limit_count: safeParseInt(e.target.value)
                })}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>Specific Gravity</Label>
              <Input
                type="number"
                value={formData.test_summary.specific_gravity_count}
                onChange={(e) => handleInputChange('test_summary', {
                  ...formData.test_summary,
                  specific_gravity_count: safeParseInt(e.target.value)
                })}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>Sieve Analysis</Label>
              <Input
                type="number"
                value={formData.test_summary.sieve_analysis_count}
                onChange={(e) => handleInputChange('test_summary', {
                  ...formData.test_summary,
                  sieve_analysis_count: safeParseInt(e.target.value)
                })}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>Hydrometer Test</Label>
              <Input
                type="number"
                value={formData.test_summary.hydrometer_test_count}
                onChange={(e) => handleInputChange('test_summary', {
                  ...formData.test_summary,
                  hydrometer_test_count: safeParseInt(e.target.value)
                })}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>Direct Shear Test</Label>
              <Input
                type="number"
                value={formData.test_summary.direct_shear_test_count}
                onChange={(e) => handleInputChange('test_summary', {
                  ...formData.test_summary,
                  direct_shear_test_count: safeParseInt(e.target.value)
                })}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>Natural Density</Label>
              <Input
                type="number"
                value={formData.test_summary.natural_density_count}
                onChange={(e) => handleInputChange('test_summary', {
                  ...formData.test_summary,
                  natural_density_count: safeParseInt(e.target.value)
                })}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>Consolidation Test</Label>
              <Input
                type="number"
                value={formData.test_summary.consolidation_test_count}
                onChange={(e) => handleInputChange('test_summary', {
                  ...formData.test_summary,
                  consolidation_test_count: safeParseInt(e.target.value)
                })}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>UCS</Label>
              <Input
                type="number"
                value={formData.test_summary.ucs_count}
                onChange={(e) => handleInputChange('test_summary', {
                  ...formData.test_summary,
                  ucs_count: safeParseInt(e.target.value)
                })}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>Triaxial Test</Label>
              <Input
                type="number"
                value={formData.test_summary.triaxial_test_count}
                onChange={(e) => handleInputChange('test_summary', {
                  ...formData.test_summary,
                  triaxial_test_count: safeParseInt(e.target.value)
                })}
                disabled={isReadOnly}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review & Approval */}
      <Card>
        <CardHeader>
          <CardTitle>Review & Approval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="reviewed_by">Reviewed By</Label>
            <Input
              id="reviewed_by"
              value={formData.reviewed_by}
              onChange={(e) => handleInputChange('reviewed_by', e.target.value)}
              disabled={isReadOnly}
              placeholder="Enter reviewer name"
            />
          </div>
          <div>
            <Label htmlFor="review_comments">Review Comments</Label>
            <Textarea
              id="review_comments"
              value={formData.review_comments}
              onChange={(e) => handleInputChange('review_comments', e.target.value)}
              disabled={isReadOnly}
              placeholder="Enter review comments"
            />
          </div>
          <div>
            <Label htmlFor="approval_status">Approval Status</Label>
            <Select
              value={formData.approval_status}
              onValueChange={(value) => handleInputChange('approval_status', value)}
              disabled={isReadOnly}
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
                <Button variant="outline" className="w-full justify-start text-left font-normal" disabled={isReadOnly}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.approval_date ? format(formData.approval_date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.approval_date}
                  onSelect={(date) => handleInputChange('approval_date', date)}
                  disabled={isReadOnly}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
