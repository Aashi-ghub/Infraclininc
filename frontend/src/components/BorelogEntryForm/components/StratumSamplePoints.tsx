import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { formatNumber, parseNumber } from './utils';

interface SamplePoint {
  id: string;
  sample_type: string;
  depth_mode: 'single' | 'range';
  depth_single?: number | null;
  depth_from?: number | null;
  depth_to?: number | null;
  run_length?: number | null;
  spt_15cm_1?: number | null;
  spt_15cm_2?: number | null;
  spt_15cm_3?: number | null;
  n_value?: number | null;
  total_core_length_cm?: number | null;
  tcr_percent?: number | null;
  rqd_length?: number | null;
  rqd_percent?: number | null;
}

interface StratumSamplePointsProps {
  samples: SamplePoint[];
  onChange: (samples: SamplePoint[]) => void;
  canEdit: boolean;
}

export function StratumSamplePoints({ samples, onChange, canEdit }: StratumSamplePointsProps) {
  const addSamplePoint = () => {
    const newSample: SamplePoint = {
      id: Math.random().toString(36).substr(2, 9),
      sample_type: '',
      depth_mode: 'single',
      depth_single: 0,
      depth_from: null,
      depth_to: null,
      run_length: null,
      spt_15cm_1: 0,
      spt_15cm_2: 0,
      spt_15cm_3: 0,
      n_value: 0,
      total_core_length_cm: 0,
      tcr_percent: 0,
      rqd_length: 0,
      rqd_percent: 0
    };
    onChange([...samples, newSample]);
  };

  const removeSamplePoint = (index: number) => {
    onChange(samples.filter((_, i) => i !== index));
  };

  const updateSamplePoint = (index: number, field: string, value: any) => {
    const newSamples = [...samples];
    const sample = { ...newSamples[index] };

    // Update the field
    (sample as any)[field] = value;

    // Calculate N-value when SPT values change
    if (field.startsWith('spt_15cm_')) {
      const spt1 = sample.spt_15cm_1 || 0;
      const spt2 = sample.spt_15cm_2 || 0;
      const spt3 = sample.spt_15cm_3 || 0;
      sample.n_value = spt1 + spt2 + spt3;
    }

    // Calculate percentages if run_length exists
    if (sample.run_length && sample.run_length > 0) {
      if (field === 'total_core_length_cm') {
        sample.tcr_percent = (value / sample.run_length) * 100;
      }
      if (field === 'rqd_length') {
        sample.rqd_percent = (value / sample.run_length) * 100;
      }
    }

    // Derived calculations for depth/range and run length
    if (field === 'depth_mode') {
      if (value === 'single') {
        sample.depth_single = sample.depth_single ?? 0;
        sample.depth_from = null;
        sample.depth_to = null;
        sample.run_length = null;
      } else {
        sample.depth_from = sample.depth_from ?? 0;
        sample.depth_to = sample.depth_to ?? 0;
        sample.depth_single = null;
        const from = sample.depth_from ?? 0;
        const to = sample.depth_to ?? 0;
        sample.run_length = to - from;
      }
    }
    if (['depth_from', 'depth_to'].includes(field)) {
      if (sample.depth_mode === 'range') {
        const from = sample.depth_from ?? 0;
        const to = sample.depth_to ?? 0;
        sample.run_length = to - from;
      }
    }

    // Recalculate percentages if run_length changes
    if (sample.run_length && sample.run_length > 0) {
      if (typeof sample.total_core_length_cm === 'number') {
        sample.tcr_percent = (sample.total_core_length_cm / sample.run_length) * 100;
      }
      if (typeof sample.rqd_length === 'number') {
        sample.rqd_percent = (sample.rqd_length / sample.run_length) * 100;
      }
    } else {
      sample.tcr_percent = 0;
      sample.rqd_percent = 0;
    }

    newSamples[index] = sample;
    onChange(newSamples);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-200">
          <thead>
            <tr className="bg-blue-50">
              <th className="border p-2">Type</th>
              <th className="border p-2">Depth (m)</th>
              <th className="border p-2">Run Length</th>
              <th className="border p-2" colSpan={3}>SPT (15cm)</th>
              <th className="border p-2">N-Value</th>
              <th className="border p-2">Core Length</th>
              <th className="border p-2">TCR %</th>
              <th className="border p-2">RQD Length</th>
              <th className="border p-2">RQD %</th>
              {canEdit && <th className="border p-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {samples.map((sample, index) => (
              <tr key={sample.id}>
                <td className="border p-2">
                  <Input
                    disabled={!canEdit}
                    value={sample.sample_type}
                    onChange={(e) => updateSamplePoint(index, 'sample_type', e.target.value)}
                    placeholder="S/D-1, U-1"
                    className="w-24"
                  />
                </td>
                <td className="border p-2">
                  {sample.depth_mode === 'range' ? (
                    <div className="flex items-center gap-1">
                      <Input
                        disabled={!canEdit}
                        type="number"
                        step="0.01"
                        value={formatNumber(sample.depth_from ?? 0)}
                        onChange={(e) => updateSamplePoint(index, 'depth_from', parseNumber(e.target.value))}
                        className="w-20"
                      />
                      <span>-</span>
                      <Input
                        disabled={!canEdit}
                        type="number"
                        step="0.01"
                        value={formatNumber(sample.depth_to ?? 0)}
                        onChange={(e) => updateSamplePoint(index, 'depth_to', parseNumber(e.target.value))}
                        className="w-20"
                      />
                      {canEdit && (
                        <button
                          type="button"
                          className="ml-2 text-xs px-2 py-1 border rounded"
                          onClick={() => updateSamplePoint(index, 'depth_mode', 'single')}
                          title="Switch to single depth"
                        >
                          Single
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        disabled={!canEdit}
                        type="number"
                        step="0.01"
                        value={formatNumber(sample.depth_single ?? 0)}
                        onChange={(e) => updateSamplePoint(index, 'depth_single', parseNumber(e.target.value))}
                        className="w-20"
                      />
                      {canEdit && (
                        <button
                          type="button"
                          className="text-xs px-2 py-1 border rounded"
                          onClick={() => updateSamplePoint(index, 'depth_mode', 'range')}
                          title="Switch to depth range"
                        >
                          Range
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td className="border p-2">
                  <Input
                    disabled={true}
                    type="number"
                    step="0.01"
                    value={formatNumber(sample.run_length)}
                    className="w-20 bg-gray-50"
                  />
                </td>
                <td className="border p-2">
                  <Input
                    disabled={!canEdit}
                    type="number"
                    value={formatNumber(sample.spt_15cm_1)}
                    onChange={(e) => updateSamplePoint(index, 'spt_15cm_1', parseNumber(e.target.value))}
                    className="w-16"
                  />
                </td>
                <td className="border p-2">
                  <Input
                    disabled={!canEdit}
                    type="number"
                    value={formatNumber(sample.spt_15cm_2)}
                    onChange={(e) => updateSamplePoint(index, 'spt_15cm_2', parseNumber(e.target.value))}
                    className="w-16"
                  />
                </td>
                <td className="border p-2">
                  <Input
                    disabled={!canEdit}
                    type="number"
                    value={formatNumber(sample.spt_15cm_3)}
                    onChange={(e) => updateSamplePoint(index, 'spt_15cm_3', parseNumber(e.target.value))}
                    className="w-16"
                  />
                </td>
                <td className="border p-2">
                  <Input
                    disabled={true}
                    type="number"
                    value={formatNumber(sample.n_value)}
                    className="w-16 bg-gray-50"
                  />
                </td>
                <td className="border p-2">
                  <Input
                    disabled={!canEdit}
                    type="number"
                    value={formatNumber(sample.total_core_length_cm)}
                    onChange={(e) => updateSamplePoint(index, 'total_core_length_cm', parseNumber(e.target.value))}
                    className="w-20"
                  />
                </td>
                <td className="border p-2">
                  <Input
                    disabled={true}
                    type="number"
                    value={formatNumber(sample.tcr_percent)}
                    className="w-16 bg-gray-50"
                  />
                </td>
                <td className="border p-2">
                  <Input
                    disabled={!canEdit}
                    type="number"
                    value={formatNumber(sample.rqd_length)}
                    onChange={(e) => updateSamplePoint(index, 'rqd_length', parseNumber(e.target.value))}
                    className="w-20"
                  />
                </td>
                <td className="border p-2">
                  <Input
                    disabled={true}
                    type="number"
                    value={formatNumber(sample.rqd_percent)}
                    className="w-16 bg-gray-50"
                  />
                </td>
                {canEdit && (
                  <td className="border p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSamplePoint(index)}
                      className="text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={addSamplePoint}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Sample
          </Button>
        </div>
      )}
    </div>
  );
}