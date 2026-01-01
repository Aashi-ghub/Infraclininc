import React from 'react';
import { formatNumber } from './utils';

interface SamplePoint {
  id?: string;
  sample_type?: string | null;
  sample_code?: string | null;
  depth_from?: number | null;
  depth_to?: number | null;
  depth_single?: number | null;
  run_length?: number | null;
  run_length_m?: number | null;
  spt_blows_1?: number | null;
  spt_blows_2?: number | null;
  spt_blows_3?: number | null;
  penetration_15cm?: (number | null)[] | null;
  n_value?: number | null;
  remarks?: string | null;
}

interface StratumSamplePointsProps {
  samples: SamplePoint[];
  onChange: (samples: SamplePoint[]) => void;
  canEdit: boolean;
}

export function StratumSamplePoints({ samples, onChange, canEdit }: StratumSamplePointsProps) {
  const deriveSampleType = (sample: SamplePoint) => {
    const code = (sample.sample_code || sample.sample_type || '').trim().toUpperCase();
    if (code.startsWith('S/D')) return 'SPT';
    if (code.startsWith('U')) return 'Undisturbed';
    if (code.startsWith('D')) return 'Disturbed';
    return sample.sample_type || code || '';
  };

  const displayVal = (val: any) => (val === null || val === undefined || val === '' ? '—' : val);
  const displayDepth = (sample: SamplePoint) => {
    const from = sample.depth_from ?? sample.depth_single;
    const to = sample.depth_to;
    return { from: from ?? null, to: to ?? null };
  };
  const getBlow = (sample: SamplePoint, idx: 0 | 1 | 2) => {
    if (Array.isArray(sample.penetration_15cm)) {
      return sample.penetration_15cm[idx] ?? null;
    }
    if (idx === 0) return sample.spt_blows_1 ?? null;
    if (idx === 1) return sample.spt_blows_2 ?? null;
    return sample.spt_blows_3 ?? null;
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-200">
          <thead>
            <tr className="bg-blue-50">
              <th className="border p-2">Sample Code</th>
              <th className="border p-2">Type</th>
              <th className="border p-2">Depth From (m)</th>
              <th className="border p-2">Depth To (m)</th>
              <th className="border p-2">Run Length (m)</th>
              <th className="border p-2">SPT 15cm 1</th>
              <th className="border p-2">SPT 15cm 2</th>
              <th className="border p-2">SPT 15cm 3</th>
              <th className="border p-2">N Value</th>
              <th className="border p-2">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {samples.length === 0 && (
              <tr>
                <td className="border p-2 text-center text-sm text-gray-500" colSpan={6}>
                  No samples
                </td>
              </tr>
            )}
            {samples.map((sample, index) => (
              <tr key={sample.id || index}>
                <td className="border p-2">{displayVal(sample.sample_code)}</td>
                <td className="border p-2">{displayVal(deriveSampleType(sample))}</td>
                {(() => {
                  const d = displayDepth(sample);
                  return (
                    <>
                      <td className="border p-2">{displayVal(d.from)}</td>
                      <td className="border p-2">{displayVal(d.to)}</td>
                    </>
                  );
                })()}
                <td className="border p-2">
                  {displayVal(sample.run_length_m ?? sample.run_length)}
                </td>
                <td className="border p-2">{displayVal(getBlow(sample, 0))}</td>
                <td className="border p-2">{displayVal(getBlow(sample, 1))}</td>
                <td className="border p-2">{displayVal(getBlow(sample, 2))}</td>
                <td className="border p-2">{displayVal(sample.n_value)}</td>
                <td className="border p-2">{displayVal(sample.remarks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}