import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, X, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { geologicalLogApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';

interface BorelogCSVUploadProps {
  projects: Array<{ project_id: string; name: string }>;
  onUploadSuccess?: () => void;
  selectedProjectId?: string; // Optional: when provided, use this and hide selector
  selectedStructureId?: string;
  selectedSubstructureId?: string;
}

interface UploadResult {
  borelog_id: string;
  submission_id: string;
  job_code: string;
  stratum_layers_created: number;
}

interface UploadError {
  row: number;
  error?: string;
  errors?: string[];
}

interface UploadResponse {
  borelog_id: string;
  submission_id: string;
  job_code: string;
  stratum_layers_created: number;
  stratum_errors: UploadError[];
  summary: {
    total_stratum_rows: number;
    successful_stratum_layers: number;
    failed_stratum_rows: number;
  };
}

export function BorelogCSVUpload({ projects, onUploadSuccess, selectedProjectId, selectedStructureId, selectedSubstructureId }: BorelogCSVUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>(selectedProjectId || '');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Keep internal state in sync if parent changes selection
  useEffect(() => {
    if (selectedProjectId) {
      setSelectedProject(selectedProjectId);
    }
  }, [selectedProjectId]);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!validExtensions.includes(fileExtension)) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a CSV, XLSX, or XLS file.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select a file smaller than 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a file to upload.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedProject) {
      toast({
        title: 'No project selected',
        description: 'Please select a project before uploading.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Read file content
      const fileContent = await selectedFile.text();
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Determine file type
      const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
      const fileType = fileExtension === '.csv' ? 'csv' : 'xlsx';

      // Prepare request data
      const requestData = {
        csvData: fileContent,
        fileType: fileType,
        projectId: selectedProject,
        structureId: selectedStructureId,
        substructureId: selectedSubstructureId,
      };

      // Make API call via API client (handles base URL and auth)
      const apiResponse = await geologicalLogApi.uploadBorelogCSV(requestData);

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = apiResponse.data;

      if (result.success) {
        toast({
          title: 'Upload successful',
          description: `Borelog created successfully with ${result.data.stratum_layers_created} stratum layers.`,
        });

        // Call success callback
        if (onUploadSuccess) {
          onUploadSuccess();
        }

        // Reset form
        setSelectedFile(null);
        setUploadProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'An error occurred during upload.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const downloadTemplate = (format: 'csv' | 'excel' = 'csv') => {
    const template = `project_id,structure_id,substructure_id,borehole_id,project_name,job_code,chainage_km,borehole_no,msl,method_of_boring,diameter_of_hole,section_name,location,coordinate_e,coordinate_l,commencement_date,completion_date,standing_water_level,termination_depth,permeability_tests_count,spt_tests_count,vs_tests_count,undisturbed_samples_count,disturbed_samples_count,water_samples_count,version_number,status,edited_by,editor_name,remarks
"550e8400-e29b-41d4-a716-446655440000","550e8400-e29b-41d4-a716-446655440001","550e8400-e29b-41d4-a716-446655440002","550e8400-e29b-41d4-a716-446655440003","Project Name","JOB001",10.5,"BH-01",45.2,"Rotary Drilling","150 mm","CNE-AGTL","BR-365 (STEEL GIDER)","103.6789","1.2345","18.01.24","19.01.24",0.70,40.45,0,22,0,5,23,1,1,"draft","550e8400-e29b-41d4-a716-446655440004","John Doe","Initial borelog entry"
stratum_description,stratum_depth_from,stratum_depth_to,stratum_thickness_m,sample_event_type,sample_event_depth_m,run_length_m,spt_blows_1,spt_blows_2,spt_blows_3,n_value_is_2131,total_core_length_cm,tcr_percent,rqd_length_cm,rqd_percent,return_water_colour,water_loss,borehole_diameter,remarks,is_subdivision,parent_row_id
"Grey colour silty clay with mixed grass roots & brownish colour patches observed",0.00,0.70,0.70,"D-1",0.35,0.45,3,4,5,9,,,,"BROWNISH",,,"SAMPLE RECEIVED",false,
"Dark grey colour, fine grained, clayey silty sand",0.70,1.20,0.50,"S/D-1",0.95,0.45,8,30,41,71,,,,"GREYISH",,,"SAMPLE RECEIVED",false,
"Soft, dark grey colour, clayey silt with traces of very fine sand & mica",1.20,7.00,5.80,"S/D-2",4.10,0.45,38,37,39,76,,,,"GREYISH",,,"SAMPLE RECEIVED",false,
"Medium stiff to stiff, deep grey colour silty clay/clayey silt",7.00,14.50,7.50,"U-1",10.75,0.45,43,54,64,118,,,,"PARTIAL",,,"SAMPLE RECEIVED",false,
"Dense, blackish grey colour, fine grained silty sand with little % of clay mixed occasionally clayey silt layer observed",14.50,24.00,9.50,"S/D-3",19.25,0.45,55,49,52,101,,,,"PARTIAL",,,"SAMPLE RECEIVED",false,
"Hard deep grey colour, silt with little % of clay binder, occasionally dark grey colour fine grained silty sand layer observed",24.00,40.45,16.45,"R/C-1",32.23,0.45,56,61,64,120,35,78,,"PARTIAL",,150,"SAMPLE RECEIVED",false,`;
    
    if (format === 'csv') {
      const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'borelog_template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // For Excel, we'll create a simple CSV that can be opened in Excel
      // Users can save it as .xlsx format
      const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'borelog_template.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: 'Template Downloaded',
        description: 'CSV template downloaded. You can open it in Excel and save as .xlsx format.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Project Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Project Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="project">Project</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.project_id} value={project.project_id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Borelog CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drag and Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              Drop your CSV file here
            </p>
            <p className="text-sm text-gray-500 mb-4">
              or click to browse files
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
          </div>

          {/* Selected File */}
          {selectedFile && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading || !selectedProject}
            className="w-full"
          >
            {isUploading ? 'Uploading...' : 'Upload Borelog'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
} 