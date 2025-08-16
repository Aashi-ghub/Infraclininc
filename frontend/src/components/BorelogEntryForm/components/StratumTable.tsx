import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { BorelogFormData, StratumRow } from './types';
import { createStratumRow, calculateDependentFields, updateTestCounts, formatNumber, parseNumber } from './utils';

interface StratumTableProps {
  form: UseFormReturn<BorelogFormData>;
  canEdit: boolean;
}

export function StratumTable({ form, canEdit }: StratumTableProps) {
  const stratumRows = form.watch('stratum_rows') || [];

  // Add new stratum row
  const addStratumRow = () => {
    const newRow = createStratumRow();
    const currentRows = form.getValues('stratum_rows');
    form.setValue('stratum_rows', [...currentRows, newRow]);
  };

  // Add subdivision to a parent row
  const addSubdivision = (parentIndex: number) => {
    const currentRows = form.getValues('stratum_rows');
    const parentRow = currentRows[parentIndex];
    
    // Count existing subdivisions for this parent
    const subdivisionCount = currentRows.filter(row => row.parent_id === parentRow.id).length;
    
    const newSubdivision = createStratumRow(true, parentRow.id);
    newSubdivision.subdivision_number = subdivisionCount + 1;
    
    // Insert subdivision after the last subdivision of this parent
    let insertIndex = parentIndex + 1;
    for (let i = parentIndex + 1; i < currentRows.length; i++) {
      if (currentRows[i].parent_id === parentRow.id) {
        insertIndex = i + 1;
      } else if (!currentRows[i].is_subdivision) {
        break;
      }
    }
    
    const newRows = [...currentRows];
    newRows.splice(insertIndex, 0, newSubdivision);
    form.setValue('stratum_rows', newRows);
  };

  // Remove stratum row
  const removeStratumRow = (index: number) => {
    const currentRows = form.getValues('stratum_rows');
    const rowToRemove = currentRows[index];
    
    // If removing a parent row, also remove all its subdivisions
    const rowsToRemove = [index];
    if (!rowToRemove.is_subdivision) {
      for (let i = 0; i < currentRows.length; i++) {
        if (currentRows[i].parent_id === rowToRemove.id) {
          rowsToRemove.push(i);
        }
      }
    }
    
    // Remove the rows in reverse order to maintain correct indices
    const newRows = [...currentRows];
    rowsToRemove.sort((a, b) => b - a).forEach(idx => {
      newRows.splice(idx, 1);
    });
    
    form.setValue('stratum_rows', newRows);
    updateTestCounts(newRows, form.setValue);
  };

  // Toggle subdivision visibility
  const toggleSubdivisions = (index: number) => {
    const currentRows = form.getValues('stratum_rows');
    const updatedRows = [...currentRows];
    const row = updatedRows[index];
    
    if (!row.is_subdivision) {
      row.is_collapsed = !row.is_collapsed;
      form.setValue('stratum_rows', updatedRows);
    }
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
    
    // If this is a main stratum, update all its subdivisions
    if (!row.is_subdivision) {
      const mainStratumId = row.id;
      for (let i = 0; i < updatedRows.length; i++) {
        if (updatedRows[i].parent_id === mainStratumId) {
          // Keep subdivision's own depth range but update thickness
          if (field === 'depth_from' || field === 'depth_to') {
            const from = updatedRows[i].depth_from;
            const to = updatedRows[i].depth_to;
            if (from !== null && to !== null) {
              updatedRows[i].thickness = to - from;
            }
          }
        }
      }
    }
    
    form.setValue('stratum_rows', updatedRows);
    updateTestCounts(updatedRows, form.setValue);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Stratum Data</CardTitle>
          {canEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addStratumRow}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Row
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-2">
          <div className="sticky top-0 z-10 bg-white shadow-sm">
            <table className="w-full border-collapse border border-gray-300 text-xs excel-table">
              <thead>
                {/* Multi-row header matching Excel structure */}
                <tr className="bg-gray-100 h-8">
                  <th rowSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs font-semibold align-middle" title="Description of Soil Stratum & Rock Methodology">
                    <div>Description of Soil Stratum & Rock Methodology</div>
                  </th>
                  <th colSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs font-semibold" title="Depth of Stratum (m)">
                    <div>Depth of Stratum (m)</div>
                  </th>
                  <th rowSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs font-semibold align-middle" title="Thickness of Stratum (m)">
                    <div>Thickness of Stratum (m)</div>
                  </th>
                  <th colSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs font-semibold" title="Sample/Event Type and Depth">
                    <div>Sample / Event</div>
                  </th>
                  <th rowSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs font-semibold align-middle" title="Run Length (m)">
                    <div>Run Length (m)</div>
                  </th>
                  <th colSpan={3} className="border border-gray-300 px-1 py-0.5 text-xs font-semibold" title="Standard Penetration Test - Blows for every 15 cm Penetration">
                    <div>Standard Penetration Test (Blows for every 15 cm Penetration)</div>
                  </th>
                  <th rowSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs font-semibold align-middle" title="N-Value IS-2131">
                    <div>N - Value<br />IS - 2131</div>
                  </th>
                  <th rowSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs font-semibold align-middle" title="Total Core Length (cm)">
                    <div>Total Core<br />Length (cm)</div>
                  </th>
                  <th rowSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs font-semibold align-middle" title="Total Core Recovery %">
                    <div>TCR (%)</div>
                  </th>
                  <th rowSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs font-semibold align-middle" title="Rock Quality Designation Length (cm)">
                    <div>RQD Length<br />(cm)</div>
                  </th>
                  <th rowSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs font-semibold align-middle" title="Rock Quality Designation %">
                    <div>RQD (%)</div>
                  </th>
                  <th rowSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs font-semibold align-middle" title="Colour of return water">
                    <div>Colour of<br />return water</div>
                  </th>
                  <th rowSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs font-semibold align-middle" title="Water loss during drilling">
                    <div>Water loss</div>
                  </th>
                  <th rowSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs font-semibold align-middle" title="Diameter of Bore hole">
                    <div>Diameter of<br />Bore hole</div>
                  </th>
                  <th rowSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs font-semibold align-middle" title="Additional remarks and observations">
                    <div>Remarks</div>
                  </th>
                  {canEdit && (
                    <th rowSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs font-semibold align-middle" title="Row actions">
                      <div>Actions</div>
                    </th>
                  )}
                </tr>
                <tr className="bg-gray-100 h-8">
                  <th className="border border-gray-300 px-1 py-0.5 text-xs font-semibold" title="Depth From (m)">
                    <div>From</div>
                  </th>
                  <th className="border border-gray-300 px-1 py-0.5 text-xs font-semibold" title="Depth To (m)">
                    <div>To</div>
                  </th>
                  <th className="border border-gray-300 px-1 py-0.5 text-xs font-semibold" title="Sample/Event Type">
                    <div>Type</div>
                  </th>
                  <th className="border border-gray-300 px-1 py-0.5 text-xs font-semibold" title="Sample Depth (m)">
                    <div>Depth (m)</div>
                  </th>
                  <th className="border border-gray-300 px-1 py-0.5 text-xs font-semibold" title="SPT 1st 15cm blows">
                    <div>15 cm</div>
                  </th>
                  <th className="border border-gray-300 px-1 py-0.5 text-xs font-semibold" title="SPT 2nd 15cm blows">
                    <div>15 cm</div>
                  </th>
                  <th className="border border-gray-300 px-1 py-0.5 text-xs font-semibold" title="SPT 3rd 15cm blows">
                    <div>15 cm</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {stratumRows.map((row, index) => {
                  // Calculate rowspan for parent rows
                  const subdivisionCount = row.is_subdivision ? 0 : stratumRows.filter(r => r.parent_id === row.id).length;
                  const rowSpan = subdivisionCount + 1;
                  
                  // Check if this is a subdivision
                  const isSubdivision = row.is_subdivision;
                  const parentRow = isSubdivision ? stratumRows.find(r => r.id === row.parent_id) : null;
                  
                  return (
                    <tr 
                      key={row.id} 
                      className={`${
                        isSubdivision 
                          ? 'subdivision' 
                          : `parent-row ${row.is_collapsed ? 'collapsed' : ''}`
                      }`}
                    >
                      {/* Description */}
                      {!isSubdivision && (
                        <td rowSpan={rowSpan} className="border border-gray-300 relative">
                          <Textarea
                            disabled={!canEdit}
                            value={row.description}
                            onChange={(e) => updateStratumRow(index, 'description', e.target.value)}
                            className="text-left"
                            placeholder="Enter description"
                          />
                        </td>
                      )}
                      
                      {/* Depth From */}
                      <td className="border border-gray-300">
                        <Input
                          disabled={!canEdit}
                          type="number"
                          step="0.01"
                          value={formatNumber(row.depth_from)}
                          onChange={(e) => updateStratumRow(index, 'depth_from', parseNumber(e.target.value))}
                          placeholder="0.00"
                        />
                      </td>
                      
                      {/* Depth To */}
                      <td className="border border-gray-300">
                        <Input
                          disabled={!canEdit}
                          type="number"
                          step="0.01"
                          value={formatNumber(row.depth_to)}
                          onChange={(e) => updateStratumRow(index, 'depth_to', parseNumber(e.target.value))}
                          placeholder="0.00"
                        />
                      </td>
                      
                      {/* Thickness */}
                      <td className="border border-gray-300">
                        <Input
                          disabled={true}
                          type="number"
                          step="0.01"
                          value={formatNumber(row.thickness)}
                          className="bg-gray-100"
                          placeholder="0.00"
                        />
                      </td>
                      
                      {/* Sample Type */}
                      <td className="border border-gray-300">
                        <Input
                          disabled={!canEdit}
                          value={row.sample_type}
                          onChange={(e) => updateStratumRow(index, 'sample_type', e.target.value)}
                          className="text-left"
                          placeholder="D-1, U, S/D, etc."
                        />
                      </td>
                      
                      {/* Sample Depth */}
                      <td className="border border-gray-300">
                        <Input
                          disabled={!canEdit}
                          type="number"
                          step="0.01"
                          value={formatNumber(row.sample_depth)}
                          onChange={(e) => updateStratumRow(index, 'sample_depth', parseNumber(e.target.value))}
                          placeholder="0.00"
                        />
                      </td>
                      
                      {/* Run Length */}
                      <td className="border border-gray-300">
                        <Input
                          disabled={!canEdit}
                          type="number"
                          step="0.01"
                          value={formatNumber(row.run_length)}
                          onChange={(e) => updateStratumRow(index, 'run_length', parseNumber(e.target.value))}
                          placeholder="0.00"
                        />
                      </td>
                      
                      {/* SPT 15cm 1 */}
                      <td className="border border-gray-300">
                        <Input
                          disabled={!canEdit}
                          type="number"
                          value={formatNumber(row.spt_15cm_1)}
                          onChange={(e) => updateStratumRow(index, 'spt_15cm_1', parseNumber(e.target.value))}
                          placeholder="0"
                        />
                      </td>
                      
                      {/* SPT 15cm 2 */}
                      <td className="border border-gray-300">
                        <Input
                          disabled={!canEdit}
                          type="number"
                          value={formatNumber(row.spt_15cm_2)}
                          onChange={(e) => updateStratumRow(index, 'spt_15cm_2', parseNumber(e.target.value))}
                          placeholder="0"
                        />
                      </td>
                      
                      {/* SPT 15cm 3 */}
                      <td className="border border-gray-300">
                        <Input
                          disabled={!canEdit}
                          type="number"
                          value={formatNumber(row.spt_15cm_3)}
                          onChange={(e) => updateStratumRow(index, 'spt_15cm_3', parseNumber(e.target.value))}
                          placeholder="0"
                        />
                      </td>
                      
                      {/* N-Value */}
                      <td className="border border-gray-300">
                        <Input
                          disabled={true}
                          type="number"
                          value={formatNumber(row.n_value)}
                          className="bg-gray-100"
                          placeholder="0"
                        />
                      </td>
                      
                      {/* Total Core Length */}
                      <td className="border border-gray-300">
                        <Input
                          disabled={!canEdit}
                          type="number"
                          step="0.01"
                          value={formatNumber(row.total_core_length)}
                          onChange={(e) => updateStratumRow(index, 'total_core_length', parseNumber(e.target.value))}
                          placeholder="0.00"
                        />
                      </td>
                      
                      {/* TCR % */}
                      <td className="border border-gray-300">
                        <Input
                          disabled={true}
                          type="number"
                          step="0.01"
                          value={formatNumber(row.tcr_percent)}
                          className="bg-gray-100"
                          placeholder="0.00"
                        />
                      </td>
                      
                      {/* RQD Length */}
                      <td className="border border-gray-300">
                        <Input
                          disabled={!canEdit}
                          type="number"
                          step="0.01"
                          value={formatNumber(row.rqd_length)}
                          onChange={(e) => updateStratumRow(index, 'rqd_length', parseNumber(e.target.value))}
                          placeholder="0.00"
                        />
                      </td>
                      
                      {/* RQD % */}
                      <td className="border border-gray-300">
                        <Input
                          disabled={true}
                          type="number"
                          step="0.01"
                          value={formatNumber(row.rqd_percent)}
                          className="bg-gray-100"
                          placeholder="0.00"
                        />
                      </td>
                      
                      {/* Return Water Color */}
                      {!isSubdivision && (
                        <td rowSpan={rowSpan} className="border border-gray-300">
                          <Input
                            disabled={!canEdit}
                            value={row.return_water_color}
                            onChange={(e) => updateStratumRow(index, 'return_water_color', e.target.value)}
                            className="text-left"
                            placeholder="Color"
                          />
                        </td>
                      )}
                      
                      {/* Water Loss */}
                      {!isSubdivision && (
                        <td rowSpan={rowSpan} className="border border-gray-300">
                          <Input
                            disabled={!canEdit}
                            value={row.water_loss}
                            onChange={(e) => updateStratumRow(index, 'water_loss', e.target.value)}
                            className="text-left"
                            placeholder="Loss"
                          />
                        </td>
                      )}
                      
                      {/* Borehole Diameter */}
                      {!isSubdivision && (
                        <td rowSpan={rowSpan} className="border border-gray-300">
                          <Input
                            disabled={!canEdit}
                            value={row.borehole_diameter}
                            onChange={(e) => updateStratumRow(index, 'borehole_diameter', e.target.value)}
                            className="text-left"
                            placeholder="Diameter"
                          />
                        </td>
                      )}
                      
                      {/* Remarks */}
                      {!isSubdivision && (
                        <td rowSpan={rowSpan} className="border border-gray-300">
                          <Textarea
                            disabled={!canEdit}
                            value={row.remarks}
                            onChange={(e) => updateStratumRow(index, 'remarks', e.target.value)}
                            className="text-left"
                            placeholder="Remarks"
                          />
                        </td>
                      )}
                      
                      {/* Actions */}
                      {canEdit && (
                        <td className="border border-gray-300">
                          <div className="flex items-center justify-center space-x-1 p-1">
                            {!isSubdivision && (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleSubdivisions(index)}
                                  className="h-4 w-4 p-0 text-xs"
                                  title={row.is_collapsed ? "Expand subdivisions" : "Collapse subdivisions"}
                                >
                                  <ChevronDown className={`h-2 w-2 transition-transform ${row.is_collapsed ? 'rotate-[-90deg]' : ''}`} />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addSubdivision(index)}
                                  className="h-4 w-4 p-0 text-xs text-blue-600"
                                  title="Add subdivision"
                                >
                                  <Plus className="h-2 w-2" />
                                </Button>
                              </>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeStratumRow(index)}
                              className="h-4 w-4 p-0 text-xs text-orange-600"
                              title="Delete subdivision"
                            >
                              <Trash2 className="h-2 w-2" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
