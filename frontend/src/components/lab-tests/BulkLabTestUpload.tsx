import React, { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { labTestApi } from '@/lib/api';

type ParsedRow = Record<string, string>;

export function BulkLabTestUpload() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handlePick = () => fileInputRef.current?.click();

  const parseCSV = async (f: File) => {
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return { headers: [], rows: [] as ParsedRow[] };
    const hdrs = lines[0].split(',').map(h => h.trim());
    const data: ParsedRow[] = lines.slice(1).map(line => {
      const values = line.split(',');
      const row: ParsedRow = {};
      hdrs.forEach((h, i) => { row[h] = (values[i] ?? '').trim(); });
      return row;
    });
    return { headers: hdrs, rows: data };
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.(csv|xlsx?)$/i.test(f.name)) {
      toast({ title: 'Invalid file type', description: 'Select a CSV or Excel file.', variant: 'destructive' });
      return;
    }
    setFile(f);
    // For now, support CSV preview only; Excel can be sent directly
    if (f.name.toLowerCase().endsWith('.csv')) {
      const parsed = await parseCSV(f);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
    } else {
      setHeaders([]);
      setRows([]);
    }
  };

  const downloadTemplateSoil = () => {
    const header = 'borelog_id,sample_id,test_date,tested_by,remarks,Soil Classification,Moisture Content,Liquid Limit,Plastic Limit,Plasticity Index';
    const example = '00000000-0000-0000-0000-000000000000,S-001,2025-01-30,Engineer,Notes,CL,18.5,42,22,20';
    const blob = new Blob([`${header}\n${example}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lab_tests_soil_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplateRock = () => {
    const header = 'borelog_id,sample_id,test_date,tested_by,remarks,Rock UCS,Point Load Index,Density,Water Absorption';
    const example = '00000000-0000-0000-0000-000000000000,R-001,2025-01-30,Engineer,Notes,80,2.1,2.65,0.8';
    const blob = new Blob([`${header}\n${example}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lab_tests_rock_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validation = useMemo(() => {
    const errors: { index: number; messages: string[] }[] = [];
    rows.forEach((r, idx) => {
      const messages: string[] = [];
      if (!r.borelog_id) messages.push('borelog_id required');
      if (!r.sample_id) messages.push('sample_id required');
      if (!r.test_date) messages.push('test_date required');
      if (r['Moisture Content'] && isNaN(Number(r['Moisture Content']))) messages.push('Moisture Content must be number');
      if (r['Liquid Limit'] && isNaN(Number(r['Liquid Limit']))) messages.push('Liquid Limit must be number');
      if (r['Plastic Limit'] && isNaN(Number(r['Plastic Limit']))) messages.push('Plastic Limit must be number');
      if (r['Plasticity Index'] && isNaN(Number(r['Plasticity Index']))) messages.push('Plasticity Index must be number');
      if (r['Rock UCS'] && isNaN(Number(r['Rock UCS']))) messages.push('Rock UCS must be number');
      if (r['Point Load Index'] && isNaN(Number(r['Point Load Index']))) messages.push('Point Load Index must be number');
      if (r['Density'] && isNaN(Number(r['Density']))) messages.push('Density must be number');
      if (r['Water Absorption'] && isNaN(Number(r['Water Absorption']))) messages.push('Water Absorption must be number');
      if (messages.length) errors.push({ index: idx, messages });
    });
    return errors;
  }, [rows]);

  const onUpload = async () => {
    if (!file) {
      toast({ title: 'No file', description: 'Choose a CSV/Excel file first.', variant: 'destructive' });
      return;
    }
    if (validation.length > 0) {
      toast({ title: 'Fix validation errors', description: 'Resolve highlighted rows before upload.', variant: 'destructive' });
      return;
    }
    try {
      setIsUploading(true);
      if (file.name.toLowerCase().endsWith('.csv')) {
        const csvData = await file.text();
        await labTestApi.bulkUpload({ csvData });
      } else {
        // Minimal Excel support placeholder: instruct to use CSV
        toast({ title: 'Excel not yet supported', description: 'Please convert to CSV.', variant: 'destructive' });
        setIsUploading(false);
        return;
      }
      toast({ title: 'Upload completed', description: 'Lab tests uploaded for approval.' });
      setFile(null);
      setRows([]);
      setHeaders([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      console.error(e);
      toast({ title: 'Upload failed', description: 'Please check the file and try again.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={handlePick} variant="secondary">Choose File</Button>
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFileChange} />
        <Button onClick={onUpload} disabled={!file || isUploading}>Upload</Button>
        <Button variant="outline" onClick={downloadTemplateSoil}>Download Soil Template</Button>
        <Button variant="outline" onClick={downloadTemplateRock}>Download Rock Template</Button>
      </div>

      {file && (
        <div className="text-sm">Selected: {file.name}</div>
      )}

      {rows.length > 0 && (
        <Card>
          <CardContent className="p-4 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="border px-2 py-1">#</th>
                  {headers.map(h => (
                    <th key={h} className="border px-2 py-1 text-left">{h}</th>
                  ))}
                  <th className="border px-2 py-1">Errors</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const err = validation.find(e => e.index === i);
                  return (
                    <tr key={i} className={err ? 'bg-red-50' : ''}>
                      <td className="border px-2 py-1">{i + 1}</td>
                      {headers.map(h => (
                        <td key={h} className="border px-2 py-1">{r[h]}</td>
                      ))}
                      <td className="border px-2 py-1 text-red-600">
                        {err ? err.messages.join('; ') : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground">
        Columns required: borelog_id, sample_id, test_date. Add soil or rock specific columns as needed. Values without matching columns are ignored.
      </div>
    </div>
  );
}

export default BulkLabTestUpload;


