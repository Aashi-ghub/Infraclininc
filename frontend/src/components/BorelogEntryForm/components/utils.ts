import { StratumRow } from './types';

// Generate unique ID for stratum rows
export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

// Update test counts based on stratum rows
export const updateTestCounts = (stratumRows: StratumRow[], setValue: (field: string, value: any) => void) => {
  const sptCount = stratumRows.filter(row => row.sample_type.includes('S')).length;
  const vsCount = stratumRows.filter(row => row.sample_type.includes('VS')).length;
  const undisturbedCount = stratumRows.filter(row => row.sample_type.includes('U')).length;
  const disturbedCount = stratumRows.filter(row => row.sample_type.includes('D')).length;
  const waterCount = stratumRows.filter(row => row.sample_type.includes('W')).length;
  
  setValue('spt_tests_count', sptCount);
  setValue('vs_tests_count', vsCount);
  setValue('undisturbed_samples_count', undisturbedCount);
  setValue('disturbed_samples_count', disturbedCount);
  setValue('water_samples_count', waterCount);
};

// Calculate dependent fields for stratum row
export const calculateDependentFields = (
  row: StratumRow,
  field: keyof StratumRow,
  value: any
): Partial<StratumRow> => {
  const updates: Partial<StratumRow> = {};

  // Calculate thickness when depth_from or depth_to changes
  if (field === 'depth_from' || field === 'depth_to') {
    const from = field === 'depth_from' ? value : row.depth_from;
    const to = field === 'depth_to' ? value : row.depth_to;
    if (from !== null && to !== null) {
      updates.thickness = to - from;
    }
  }

  // Calculate run length from sample event depth
  if (field === 'sample_depth') {
    const sampleDepth = value;
    if (sampleDepth && typeof sampleDepth === 'string') {
      const depthRange = parseDepthRange(sampleDepth);
      if (depthRange) {
        // If it's a range, calculate the difference
        const [from, to] = depthRange;
        updates.run_length = to - from;
      } else {
        // If it's a single depth, run length is not applicable
        updates.run_length = null;
      }
    }
  }

  // Calculate N-value when SPT values change
  if (field === 'spt_15cm_1' || field === 'spt_15cm_2' || field === 'spt_15cm_3') {
    const spt1 = field === 'spt_15cm_1' ? value : row.spt_15cm_1;
    const spt2 = field === 'spt_15cm_2' ? value : row.spt_15cm_2;
    const spt3 = field === 'spt_15cm_3' ? value : row.spt_15cm_3;
    if (spt1 !== null && spt2 !== null && spt3 !== null) {
      updates.n_value = spt1 + spt2 + spt3;
    }
  }

  // Calculate TCR percentage when core length or run length changes
  if (field === 'total_core_length' || field === 'run_length') {
    const coreLength = field === 'total_core_length' ? value : row.total_core_length;
    const runLength = field === 'run_length' ? value : row.run_length;
    if (coreLength !== null && runLength !== null && runLength > 0) {
      updates.tcr_percent = (coreLength / runLength) * 100;
    }
  }

  // Calculate RQD percentage when RQD length or run length changes
  if (field === 'rqd_length' || field === 'run_length') {
    const rqdLength = field === 'rqd_length' ? value : row.rqd_length;
    const runLength = field === 'run_length' ? value : row.run_length;
    if (rqdLength !== null && runLength !== null && runLength > 0) {
      updates.rqd_percent = (rqdLength / runLength) * 100;
    }
  }

  return updates;
};

// Create a new stratum row
export const createStratumRow = (isSubdivision = false, parentId?: string): StratumRow => {
  return {
    id: generateId(),
    parent_id: parentId || null,
    is_subdivision: isSubdivision,
    subdivision_number: isSubdivision ? 1 : null,
    description: '',
    depth_from: null,
    depth_to: null,
    thickness: null,
    sample_type: '',
    sample_depth: '',
    run_length: null,
    spt_15cm_1: null,
    spt_15cm_2: null,
    spt_15cm_3: null,
    n_value: null,
    total_core_length: null,
    tcr_percent: null,
    rqd_length: null,
    rqd_percent: null,
    return_water_color: '',
    water_loss: '',
    borehole_diameter: '',
    remarks: '',
    is_collapsed: false
  };
};

// Format number for display with decimal support
export const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  // Format to show up to 2 decimal places, but don't show trailing zeros
  return value.toFixed(2).replace(/\.?0+$/, '');
};

// Parse number from input with decimal support
export const parseNumber = (value: string): number | null => {
  if (!value || value.trim() === '') return null;
  // Allow decimal numbers like 0.00, 0.50, etc.
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

// Parse depth range from string (e.g., "1.50-1.95" returns [1.50, 1.95])
export const parseDepthRange = (value: string): [number, number] | null => {
  if (!value || value.trim() === '') return null;
  
  // Check if it's a range (contains "-")
  if (value.includes('-')) {
    const parts = value.split('-').map(s => s.trim());
    if (parts.length === 2) {
      const from = parseFloat(parts[0]);
      const to = parseFloat(parts[1]);
      if (!isNaN(from) && !isNaN(to)) {
        return [from, to];
      }
    }
  }
  
  // If it's a single number, return null (no range)
  return null;
};

