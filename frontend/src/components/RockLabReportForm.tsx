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
    tested_by: '',
    checked_by: '',
    approved_by: '',
    report_status: existingReport?.status || 'Draft',
    rock_test_data: existingReport?.rock_test_data || [],
    
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

  // Strip any legacy mock sample that may arrive from prior defaults
  useEffect(() => {
    const first = formData.rock_test_data?.[0];
    if (!first) return;
    const looksLikeOldMock =
      first.rock_type === 'Granite' &&
      first.result === 'Pass' &&
      Math.abs((first.diameter_mm ?? 0) - 38) < 1e-6 &&
      Math.abs((first.length_mm ?? 0) - 70) < 1e-6 &&
      Math.abs((first.point_load_index_mpa ?? 0) - 2) < 1e-6 &&
      Math.abs((first.uniaxial_compressive_strength_mpa ?? 0) - 100) < 1e-6;
    if (looksLikeOldMock && formData.rock_test_data.length === 1) {
      setFormData(prev => ({ ...prev, rock_test_data: [] }));
    }
  }, []);

  // Sync incoming rock data from parent (after version load)
  useEffect(() => {
    if (incomingRockData) {
      try {
        const next = Array.isArray(incomingRockData) ? incomingRockData : (incomingRockData.samples || []);
        setFormData(prev => {
          const prevArr = prev.rock_test_data || [];
          const sameRef = prevArr === next;
          const sameLen = Array.isArray(next) && prevArr.length === next.length;
          if (sameRef || (sameLen && JSON.stringify(prevArr) === JSON.stringify(next))) {
            return prev;
          }
          return { ...prev, rock_test_data: next };
        });
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
      depth_m: 0,
      rock_type: '',
      description: '',
      length_mm: 0,
      diameter_mm: 0,
      weight_g: 0,
      density_g_cm3: 0,
      moisture_content_percent: 0,
      water_absorption_percent: 0,
      porosity_percent: 0,
      weight_in_air_g: 0,
      weight_in_water_g: 0,
      weight_saturated_g: 0,
      volume_water_displaced_cm3: 0,
      failure_load_kn: 0,
      point_load_index_mpa: 0,
      uniaxial_compressive_strength_mpa: 0,
      brazilian_tensile_strength_mpa: 0,
      test_count: 0,
      result: 'Pending'
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
              <p className="text-sm text-muted-foreground"></p>
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
