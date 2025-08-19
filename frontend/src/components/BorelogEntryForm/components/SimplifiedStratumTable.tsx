import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import { BorelogFormData, StratumRow } from './types';
import { createStratumRow, calculateDependentFields, updateTestCounts, formatNumber, parseNumber } from './utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StratumSamplePoints } from './StratumSamplePoints';

interface StratumTableProps {
  form: UseFormReturn<BorelogFormData>;
  canEdit: boolean;
}

export function SimplifiedStratumTable({ form, canEdit }: StratumTableProps) {
  const stratumRows = form.watch('stratum_rows') || [];

  // Add new stratum row
  const addStratumRow = () => {
    const newRow = createStratumRow();
    const currentRows = form.getValues('stratum_rows');
    form.setValue('stratum_rows', [...currentRows, newRow]);
  };

  // Remove stratum row
  const removeStratumRow = (index: number) => {
    const currentRows = form.getValues('stratum_rows');
    const newRows = currentRows.filter((_, i) => i !== index);
    form.setValue('stratum_rows', newRows);
    updateTestCounts(newRows, form.setValue);
  };

  // Update stratum row field
  const updateStratumRow = (index: number, field: keyof StratumRow, value: any) => {
    const currentRows = form.getValues('stratum_rows');
    const updatedRows = [...currentRows];
    const row = updatedRows[index];
    
    // Update the field
    updatedRows[index] = { ...row, [field]: value };
    
    // Calculate dependent fields
    const updates = calculateDependentFields(row, field, value);
    Object.assign(updatedRows[index], updates);
    
    form.setValue('stratum_rows', updatedRows);
    updateTestCounts(updatedRows, form.setValue);
  };

  // Update sample points for a stratum
  const updateSamplePoints = (index: number, samples: any[]) => {
    const currentRows = form.getValues('stratum_rows');
    const updatedRows = [...currentRows];
    updatedRows[index] = {
      ...updatedRows[index],
      samples
    };
    form.setValue('stratum_rows', updatedRows);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Stratum Data</CardTitle>
          {canEdit && (
            <Button
              type="button"
              size="sm"
              onClick={addStratumRow}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Layer
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {stratumRows.map((row, index) => (
          <div key={row.id} className="mb-6 bg-white rounded-lg border">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Layer {index + 1}</h3>
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStratumRow(index)}
                    className="text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-blue-50 rounded-md">
                  <TabsTrigger value="basic" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Basic Info</TabsTrigger>
                  <TabsTrigger value="samples" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Sample Points</TabsTrigger>
                  <TabsTrigger value="water" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Water & Remarks</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        disabled={!canEdit}
                        value={row.description}
                        onChange={(e) => updateStratumRow(index, 'description', e.target.value)}
                        placeholder="Enter stratum description"
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium">Depth From (m)</label>
                        <Input
                          disabled={!canEdit}
                          type="number"
                          step="0.01"
                          value={formatNumber(row.depth_from)}
                          onChange={(e) => updateStratumRow(index, 'depth_from', parseNumber(e.target.value))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Depth To (m)</label>
                        <Input
                          disabled={!canEdit}
                          type="number"
                          step="0.01"
                          value={formatNumber(row.depth_to)}
                          onChange={(e) => updateStratumRow(index, 'depth_to', parseNumber(e.target.value))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Thickness (m)</label>
                        <Input
                          disabled={true}
                          type="number"
                          value={formatNumber(row.thickness)}
                          className="mt-1 bg-gray-50"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="samples">
                  <StratumSamplePoints
                    samples={row.samples || []}
                    onChange={(samples) => updateSamplePoints(index, samples)}
                    canEdit={canEdit}
                  />
                </TabsContent>

                <TabsContent value="water" className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium">Return Water Color</label>
                      <Input
                        disabled={!canEdit}
                        value={row.return_water_color || ''}
                        onChange={(e) => updateStratumRow(index, 'return_water_color', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Water Loss</label>
                      <Input
                        disabled={!canEdit}
                        value={row.water_loss || ''}
                        onChange={(e) => updateStratumRow(index, 'water_loss', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Borehole Diameter</label>
                      <Input
                        disabled={!canEdit}
                        value={row.borehole_diameter || ''}
                        onChange={(e) => updateStratumRow(index, 'borehole_diameter', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Remarks</label>
                    <Textarea
                      disabled={!canEdit}
                      value={row.remarks || ''}
                      onChange={(e) => updateStratumRow(index, 'remarks', e.target.value)}
                      placeholder="Additional remarks"
                      className="mt-1"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        ))}

        {stratumRows.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No stratum data added yet. Click "Add Layer" to begin.
          </div>
        )}
      </CardContent>
    </Card>
  );
}