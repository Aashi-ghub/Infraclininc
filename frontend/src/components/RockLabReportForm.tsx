import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, FlaskConical, FileText, Upload, Save, Send, Eye, Download, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface RockLabReportFormProps {
  labRequest?: any;
  existingReport?: any;
  onSubmit: (reportData: any) => void;
  onCancel: () => void;
  onSaveDraft?: (reportData: any) => void;
  isLoading?: boolean;
  userRole?: string;
  isReadOnly?: boolean;
  onDataChange?: (data: { rock_test_data: RockTestData[] }) => void;
  incomingRockData?: any;
  onMetaChange?: (meta: Partial<FormData>) => void;
}

interface RockTestData {
  sample_no: string;
  depth_m: number;
  rock_type: string;
  description: string;
  length_mm: number;
  diameter_mm: number;
  weight_g: number;
  density_g_cm3: number;
  moisture_content_percent: number;
  water_absorption_percent: number;
  porosity_percent: number;
  weight_in_air_g: number;
  weight_in_water_g: number;
  weight_saturated_g: number;
  volume_water_displaced_cm3: number;
  failure_load_kn: number;
  point_load_index_mpa: number;
  uniaxial_compressive_strength_mpa: number;
  brazilian_tensile_strength_mpa: number;
  test_count: number;
  result: string;
}

interface FormData {
  // General Info
  lab_report_id?: string;
  lab_request_id: string;
  project_name: string;
  client: string;
  borehole_no: string;
  date: Date;
  tested_by: string;
  checked_by: string;
  approved_by: string;
  report_status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';

  // Rock Test Data
  rock_test_data: RockTestData[];

  // Review Section

}

const testMethods = [
  { value: 'Caliper', label: 'Caliper Method' },
  { value: 'Buoyancy', label: 'Buoyancy Techniques' },
  { value: 'WaterDisplacement', label: 'Water Displacement' },
  { value: 'PointLoad', label: 'Point Load' },
  { value: 'UCS', label: 'Uniaxial Compressive Strength (UCS)' },
  { value: 'Brazilian', label: 'Brazilian Tensile Strength' }
];

export default function RockLabReportForm({ 
  labRequest, 
  existingReport, 
  onSubmit, 
  onCancel, 
  onSaveDraft,
  isLoading = false,
  userRole = 'Lab Engineer',
  isReadOnly = false,
  onDataChange,
  incomingRockData,
  onMetaChange
}: RockLabReportFormProps) {
  const [formData, setFormData] = useState<FormData>({
    lab_report_id: existingReport?.id || `LR-${Date.now()}`,
    lab_request_id: labRequest?.id || existingReport?.request_id || '',
    project_name: labRequest?.borelog?.project_name || existingReport?.borelog?.project_name || '',
    client: '',
    borehole_no: labRequest?.sample_id || existingReport?.sample_id || '',
    date: existingReport?.submitted_at ? new Date(existingReport.submitted_at) : new Date(),
    tested_by: 'Dr. Michael Chen',
    checked_by: 'Prof. Sarah Johnson',
    approved_by: 'Prof. David Wilson',
    report_status: existingReport?.status || 'Draft',
    rock_test_data: existingReport?.rock_test_data || [
      {
        sample_no: '1',
        depth_m: 0.50,
        rock_type: 'Granite',
        description: 'Fresh to slightly weathered granite',
        length_mm: 70.00,
        diameter_mm: 38.00,
        weight_g: 179.71,
        density_g_cm3: 2.70,
        moisture_content_percent: 0.86,
        water_absorption_percent: 0.86,
        porosity_percent: 2.33,
        weight_in_air_g: 179.71,
        weight_in_water_g: 117.97,
        weight_saturated_g: 181.24,
        volume_water_displaced_cm3: 66.57,
        failure_load_kn: 0.63,
        point_load_index_mpa: 2.00,
        uniaxial_compressive_strength_mpa: 100.00,
        brazilian_tensile_strength_mpa: 2.00,
        test_count: 1,
        result: 'Pass'
      }
    ],
    
  });


  const { toast } = useToast();
  // Bubble up rock_test_data to parent whenever it changes
  useEffect(() => {
    if (onDataChange) {
      onDataChange({ rock_test_data: formData.rock_test_data });
    }
    // Only re-run when the data array changes, not when parent re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.rock_test_data]);

  // Sync incoming rock data from parent (after version load)
  useEffect(() => {
    if (incomingRockData) {
      try {
        const next = Array.isArray(incomingRockData) ? incomingRockData : (incomingRockData.samples || []);
        setFormData(prev => ({ ...prev, rock_test_data: next }));
      } catch {
        // ignore
      }
    }
  }, [incomingRockData]);

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (onMetaChange) {
      onMetaChange({ [field]: value } as Partial<FormData>);
    }
  };

  const handleTestDataChange = (index: number, field: keyof RockTestData, value: any) => {
    setFormData(prev => ({
      ...prev,
      rock_test_data: prev.rock_test_data.map((item, i) => 
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
    const newRow: RockTestData = {
      sample_no: `${formData.rock_test_data.length + 1}`,
      depth_m: 0.50 + (formData.rock_test_data.length * 0.50),
      rock_type: '',
      description: '',
      length_mm: 70.00,
      diameter_mm: 38.00,
      weight_g: 179.71,
      density_g_cm3: 2.70,
      moisture_content_percent: 0.86,
      water_absorption_percent: 0.86,
      porosity_percent: 2.33,
      weight_in_air_g: 179.71,
      weight_in_water_g: 117.97,
      weight_saturated_g: 181.24,
      volume_water_displaced_cm3: 66.57,
      failure_load_kn: 0.63,
      point_load_index_mpa: 2.00,
      uniaxial_compressive_strength_mpa: 100.00,
      brazilian_tensile_strength_mpa: 2.00,
      test_count: 1,
      result: 'Pass'
    };
    setFormData(prev => ({
      ...prev,
      rock_test_data: [...prev.rock_test_data, newRow]
    }));
  };

  const removeTestDataRow = (index: number) => {
    setFormData(prev => ({
      ...prev,
      rock_test_data: prev.rock_test_data.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // This function is now handled by the parent component's version control
  };

  const handleSaveDraft = () => {
    // This function is now handled by the parent component's version control
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-6 w-6" />
                Laboratory Rock Tests Result Sheet
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {existingReport ? `Report ID: ${existingReport.id}` : `Borehole: ${formData.borehole_no}`}
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
             <div className="space-y-6">

                             {/* General Info Section */}
               <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="project_name">Project Name</Label>
                    <Input
                      id="project_name"
                      value={formData.project_name}
                      onChange={(e) => handleInputChange('project_name', e.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <Label htmlFor="client">Client</Label>
                    <Input
                      id="client"
                      value={formData.client}
                      onChange={(e) => handleInputChange('client', e.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <Label htmlFor="borehole_no">Borehole No.</Label>
                    <Input
                      id="borehole_no"
                      value={formData.borehole_no}
                      onChange={(e) => handleInputChange('borehole_no', e.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          disabled={isReadOnly}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.date ? format(formData.date, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.date}
                          onSelect={(date) => handleInputChange('date', date)}
                          initialFocus
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
                    />
                  </div>
                  <div>
                    <Label htmlFor="checked_by">Checked By</Label>
                    <Input
                      id="checked_by"
                      value={formData.checked_by}
                      onChange={(e) => handleInputChange('checked_by', e.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <Label htmlFor="approved_by">Approved By</Label>
                    <Input
                      id="approved_by"
                      value={formData.approved_by}
                      onChange={(e) => handleInputChange('approved_by', e.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                                 </div>
               </div>

               {/* Caliper Method Section */}
               <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Caliper Method - Sample Dimensions and Properties</h4>
                  <p className="text-sm text-muted-foreground">
                    Record sample dimensions, weights, densities, and moisture properties
                  </p>
                </div>
                
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sample No.</TableHead>
                        <TableHead>Depth (m)</TableHead>
                        <TableHead>Rock Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Length (mm)</TableHead>
                        <TableHead>Diameter (mm)</TableHead>
                        <TableHead>Weight (g)</TableHead>
                        <TableHead>Density (g/cm³)</TableHead>
                        <TableHead>Moisture Content (%)</TableHead>
                        <TableHead>Water Absorption (%)</TableHead>
                        <TableHead>Porosity (%)</TableHead>
                        {!isReadOnly && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.rock_test_data.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              value={row.sample_no}
                              onChange={(e) => handleTestDataChange(index, 'sample_no', e.target.value)}
                              disabled={isReadOnly}
                              className="w-16"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.depth_m}
                              onChange={(e) => handleTestDataChange(index, 'depth_m', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.rock_type}
                              onChange={(e) => handleTestDataChange(index, 'rock_type', e.target.value)}
                              disabled={isReadOnly}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.description}
                              onChange={(e) => handleTestDataChange(index, 'description', e.target.value)}
                              disabled={isReadOnly}
                              className="w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.length_mm}
                              onChange={(e) => handleTestDataChange(index, 'length_mm', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.diameter_mm}
                              onChange={(e) => handleTestDataChange(index, 'diameter_mm', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.weight_g}
                              onChange={(e) => handleTestDataChange(index, 'weight_g', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.001"
                              value={row.density_g_cm3}
                              onChange={(e) => handleTestDataChange(index, 'density_g_cm3', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.moisture_content_percent}
                              onChange={(e) => handleTestDataChange(index, 'moisture_content_percent', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.water_absorption_percent}
                              onChange={(e) => handleTestDataChange(index, 'water_absorption_percent', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.porosity_percent}
                              onChange={(e) => handleTestDataChange(index, 'porosity_percent', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          {!isReadOnly && (
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeTestDataRow(index)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {!isReadOnly && (
                  <Button type="button" variant="outline" onClick={addTestDataRow} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Sample Row
                  </Button>
                                 )}
               </div>

               {/* Buoyancy & Water Displacement Section */}
               <div className="space-y-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Buoyancy Techniques & Water Displacement</h4>
                  <p className="text-sm text-muted-foreground">
                    Record weights in different conditions and water displacement measurements
                  </p>
                </div>
                
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sample No.</TableHead>
                        <TableHead>Depth (m)</TableHead>
                        <TableHead>Weight in Air (g)</TableHead>
                        <TableHead>Weight in Water (g)</TableHead>
                        <TableHead>Weight Saturated (g)</TableHead>
                        <TableHead>Density (g/cm³)</TableHead>
                        <TableHead>Moisture Content (%)</TableHead>
                        <TableHead>Water Absorption (%)</TableHead>
                        <TableHead>Porosity (%)</TableHead>
                        <TableHead>Volume Water Displaced (cm³)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.rock_test_data.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.sample_no}</TableCell>
                          <TableCell>{row.depth_m}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.weight_in_air_g}
                              onChange={(e) => handleTestDataChange(index, 'weight_in_air_g', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.weight_in_water_g}
                              onChange={(e) => handleTestDataChange(index, 'weight_in_water_g', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.weight_saturated_g}
                              onChange={(e) => handleTestDataChange(index, 'weight_saturated_g', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.001"
                              value={row.density_g_cm3}
                              onChange={(e) => handleTestDataChange(index, 'density_g_cm3', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.moisture_content_percent}
                              onChange={(e) => handleTestDataChange(index, 'moisture_content_percent', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.water_absorption_percent}
                              onChange={(e) => handleTestDataChange(index, 'water_absorption_percent', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.porosity_percent}
                              onChange={(e) => handleTestDataChange(index, 'porosity_percent', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.volume_water_displaced_cm3}
                              onChange={(e) => handleTestDataChange(index, 'volume_water_displaced_cm3', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Strength Tests Section */}
              <div className="space-y-4">
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Strength Tests - Point Load, UCS, and Brazilian</h4>
                  <p className="text-sm text-muted-foreground">
                    Record strength test parameters and results
                  </p>
                </div>
                
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sample No.</TableHead>
                        <TableHead>Depth (m)</TableHead>
                        <TableHead>Length (mm)</TableHead>
                        <TableHead>Diameter (mm)</TableHead>
                        <TableHead>Failure Load (kN)</TableHead>
                        <TableHead>Point Load Index (Is50) (MPa)</TableHead>
                        <TableHead>UCS (MPa)</TableHead>
                        <TableHead>Brazilian Tensile Strength (MPa)</TableHead>
                        <TableHead>Test Count</TableHead>
                        <TableHead>Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.rock_test_data.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.sample_no}</TableCell>
                          <TableCell>{row.depth_m}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.length_mm}
                              onChange={(e) => handleTestDataChange(index, 'length_mm', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.diameter_mm}
                              onChange={(e) => handleTestDataChange(index, 'diameter_mm', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.failure_load_kn}
                              onChange={(e) => handleTestDataChange(index, 'failure_load_kn', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.point_load_index_mpa}
                              onChange={(e) => handleTestDataChange(index, 'point_load_index_mpa', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              value={row.uniaxial_compressive_strength_mpa}
                              onChange={(e) => handleTestDataChange(index, 'uniaxial_compressive_strength_mpa', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.brazilian_tensile_strength_mpa}
                              onChange={(e) => handleTestDataChange(index, 'brazilian_tensile_strength_mpa', safeParseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={row.test_count}
                              onChange={(e) => handleTestDataChange(index, 'test_count', safeParseInt(e.target.value))}
                              disabled={isReadOnly}
                              className="w-16"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={row.result}
                              onValueChange={(value) => handleTestDataChange(index, 'result', value)}
                              disabled={isReadOnly}
                            >
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Pass">Pass</SelectItem>
                                <SelectItem value="Fail">Fail</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                                 </div>
               </div>
             </div>



            {/* Form Actions */}
            <Separator />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
