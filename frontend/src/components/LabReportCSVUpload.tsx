import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { unifiedLabReportsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

interface UploadSummary {
  successful: number;
  failed: number;
  total: number;
}

interface UploadResponse {
  summary: UploadSummary;
  results: Array<{ row: number; report_id?: string; error?: string }>;
}

interface LabReportCSVUploadProps {
  onUploadSuccess?: () => void;
  defaultAssignmentId?: string;
  defaultBorelogId?: string;
}

export function LabReportCSVUpload({ onUploadSuccess, defaultAssignmentId, defaultBorelogId }: LabReportCSVUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [defaultAssignmentIdInput, setDefaultAssignmentIdInput] = useState<string>(defaultAssignmentId || '');
  const [defaultBorelogIdInput, setDefaultBorelogIdInput] = useState<string>(defaultBorelogId || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const name = file.name.toLowerCase();
    const isCsv = name.endsWith('.csv');
    const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls');
    if (!isCsv && !isXlsx) {
      toast({ title: 'Invalid file type', description: 'Please select a CSV or Excel (.xlsx/.xls) file.', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please select a file smaller than 10MB.', variant: 'destructive' });
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isUuid = (v?: string) => !!(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim()));

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({ title: 'No file selected', description: 'Please select a CSV file to upload.', variant: 'destructive' });
      return;
    }
    if (!isUuid(defaultBorelogIdInput)) {
      toast({ title: 'Missing Borelog ID', description: 'Please provide a valid default Borelog UUID.', variant: 'destructive' });
      return;
    }
    // assignment_id is optional - can be empty for drafts
    setIsUploading(true);
    setUploadProgress(0);
    try {
      let csvData = '';
      let sheets: Array<{ name: string; csv: string }> | undefined;
      const lower = selectedFile.name.toLowerCase();
      if (lower.endsWith('.csv')) {
        csvData = await selectedFile.text();
      } else {
        // Parse Excel → CSV (first sheet)
        const data = new Uint8Array(await selectedFile.arrayBuffer());
        const workbook = XLSX.read(data, { type: 'array' });
        sheets = workbook.SheetNames.map((name) => ({ name, csv: XLSX.utils.sheet_to_csv(workbook.Sheets[name]) }));
        // Keep csvData as first sheet for backward compatibility
        const firstSheet = workbook.SheetNames[0];
        csvData = XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet]);
      }
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await unifiedLabReportsApi.uploadCSV({ csvData, sheets, default_assignment_id: defaultAssignmentIdInput || undefined, default_borelog_id: defaultBorelogIdInput } as any);
      clearInterval(progressInterval);
      setUploadProgress(100);
      const result = response.data.data as UploadResponse;
      setUploadResult(result);

      if (result.summary.successful > 0) {
        toast({
          title: 'Upload completed',
          description: `Created ${result.summary.successful} draft lab reports. ${result.summary.failed} failed.`,
        });
        onUploadSuccess?.();
      } else {
        toast({ title: 'Upload failed', description: 'No lab reports were created. Check your CSV.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Upload failed', description: 'Failed to upload CSV file. Please try again.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const downloadTemplate = () => {
    const template = `assignment_id,borelog_id,sample_id,project_name,borehole_no,client,test_date,tested_by,checked_by,approved_by,test_types,soil_test_data,rock_test_data,remarks\n,00000000-0000-0000-0000-000000000000,SAMPLE-001,Project A,BH-01,Client A,2025-01-30,John Doe,Jane Roe,Dr. Smith,"Soil;Rock","[]","[]","Initial draft"`;
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lab_reports_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Unified Lab Reports (CSV/Excel)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs font-medium">Default Borelog ID</label>
            <Input placeholder="Paste Borelog UUID" value={defaultBorelogIdInput} onChange={(e) => setDefaultBorelogIdInput(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium">Default Assignment ID (optional)</label>
            <Input placeholder="Paste Assignment UUID" value={defaultAssignmentIdInput} onChange={(e) => setDefaultAssignmentIdInput(e.target.value)} />
          </div>
        </div>
        <div
          className={`border-2 border-dashed rounded-md p-6 text-center ${isDragOver ? 'bg-muted' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
          {!selectedFile ? (
            <div>
              <p className="mb-2">Drag and drop a CSV/Excel file here, or</p>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Browse</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm">Selected: {selectedFile.name}</div>
              <div className="flex gap-2">
                <Button onClick={handleUpload} disabled={isUploading}>Upload</Button>
                <Button variant="secondary" onClick={removeFile} disabled={isUploading}>Remove</Button>
                <Button variant="outline" onClick={downloadTemplate} disabled={isUploading}>Download Template</Button>
              </div>
            </div>
          )}
        </div>

        {isUploading && (
          <div className="mt-4">
            <Progress value={uploadProgress} />
          </div>
        )}

        {uploadResult && (
          <div className="mt-4 text-sm">
            <div>Created: {uploadResult.summary.successful}</div>
            <div>Errors: {uploadResult.summary.failed}</div>
            <div>Total: {uploadResult.summary.total}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LabReportCSVUpload;


