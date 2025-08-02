import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, X, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { geologicalLogApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BorelogCSVUploadProps {
  projects: Array<{ project_id: string; name: string }>;
  onUploadSuccess?: () => void;
}

interface UploadResult {
  row: number;
  borehole_number: string;
  borelog_id: string;
  status: 'created';
}

interface UploadError {
  row: number;
  borehole_number?: string;
  errors?: string[];
  error?: string;
}

interface UploadResponse {
  created: UploadResult[];
  errors: UploadError[];
  summary: {
    total_rows: number;
    successful: number;
    failed: number;
  };
}

export function BorelogCSVUpload({ projects, onUploadSuccess }: BorelogCSVUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a CSV file.',
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
    setUploadResult(null);
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
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedProject) {
      toast({
        title: 'Missing information',
        description: 'Please select both a CSV file and a project.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Read the CSV file
      const csvData = await selectedFile.text();
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Upload to API
      const response = await geologicalLogApi.uploadCSV({
        csvData,
        projectId: selectedProject
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = response.data.data as UploadResponse;
      setUploadResult(result);

      // Show success/error toast
      if (result.summary.successful > 0) {
        toast({
          title: 'Upload completed',
          description: `Successfully created ${result.summary.successful} geological logs. ${result.summary.failed} errors occurred.`,
        });
        onUploadSuccess?.();
      } else {
        toast({
          title: 'Upload failed',
          description: 'No geological logs were created. Please check your CSV format.',
          variant: 'destructive',
        });
      }

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload CSV file. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const downloadTemplate = () => {
    const template = `project_name,client_name,design_consultant,job_code,project_location,chainage_km,area,borehole_location,borehole_number,msl,method_of_boring,diameter_of_hole,commencement_date,completion_date,standing_water_level,termination_depth,coordinate_lat,coordinate_lng,type_of_core_barrel,bearing_of_hole,collar_elevation,logged_by,checked_by
"Project A","Client A","Consultant A","JOB001","Location A",10.5,"Area A","Borehole Location A","BH001","45.2m","Rotary Drilling",150,"2024-01-15","2024-01-16",12.5,30.5,1.2345,103.6789,"Core Barrel Type A","N45E",45.2,"John Doe","Jane Smith"`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'borelog_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Project Selection */}
      <div>
        <label className="text-sm font-medium mb-2 block">Select Project</label>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a project for the CSV upload" />
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

      {/* File Upload Area */}
      <Card
        className={cn(
          "border-2 border-dashed transition-colors",
          isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="p-6">
          <div className="text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Drop CSV file here or{' '}
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  browse
                </Button>
              </p>
              <p className="text-xs text-muted-foreground">
                Maximum file size: 10MB
              </p>
              <p className="text-xs text-muted-foreground">
                Format: CSV with headers matching the template
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Selected File */}
      {selectedFile && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeFile}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Results */}
      {uploadResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Upload Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">{uploadResult.summary.successful}</p>
                <p className="text-sm text-muted-foreground">Created</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{uploadResult.summary.failed}</p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{uploadResult.summary.total_rows}</p>
                <p className="text-sm text-muted-foreground">Total Rows</p>
              </div>
            </div>

            {/* Error Details */}
            {uploadResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Errors occurred in the following rows:</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {uploadResult.errors.map((error, index) => (
                        <div key={index} className="text-sm">
                          <span className="font-medium">Row {error.row}:</span>{' '}
                          {error.borehole_number && `BH: ${error.borehole_number} - `}
                          {error.errors ? error.errors.join(', ') : error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={downloadTemplate}
          disabled={isUploading}
        >
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
        
        <Button
          type="button"
          onClick={handleUpload}
          disabled={!selectedFile || !selectedProject || isUploading}
          className="flex-1"
        >
          {isUploading ? (
            <>
              <Upload className="h-4 w-4 mr-2 animate-pulse" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </>
          )}
        </Button>
      </div>
    </div>
  );
} 