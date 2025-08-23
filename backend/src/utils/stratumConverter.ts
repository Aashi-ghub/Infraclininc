import { v4 as uuidv4 } from 'uuid';

interface ScalarStratumData {
  stratum_description?: string;
  stratum_depth_from?: number;
  stratum_depth_to?: number;
  stratum_thickness_m?: number;
  sample_event_type?: string;
  sample_event_depth_m?: number;
  run_length_m?: number;
  spt_blows_per_15cm?: number;
  n_value_is_2131?: string;
  total_core_length_cm?: number;
  tcr_percent?: number;
  rqd_length_cm?: number;
  rqd_percent?: number;
  return_water_colour?: string;
  water_loss?: string;
  borehole_diameter?: number;
}

interface StratumLayer {
  id: string;
  description: string;
  depth_from_m: number | null;
  depth_to_m: number | null;
  thickness_m: number | null;
  return_water_colour: string | null;
  water_loss: string | null;
  borehole_diameter: number | null;
  remarks: string | null;
  samples: StratumSamplePoint[];
}

interface StratumSamplePoint {
  id: string;
  sample_type: string;
  depth_mode: 'single' | 'range';
  depth_single_m: number | null;
  depth_from_m: number | null;
  depth_to_m: number | null;
  run_length_m: number | null;
  spt_15cm_1: number | null;
  spt_15cm_2: number | null;
  spt_15cm_3: number | null;
  n_value: number | null;
  total_core_length_cm: number | null;
  tcr_percent: number | null;
  rqd_length_cm: number | null;
  rqd_percent: number | null;
}

export function convertScalarToRelational(scalarData: ScalarStratumData): StratumLayer[] {
  // If no stratum data, return empty array
  if (!scalarData.stratum_description && !scalarData.stratum_depth_to) {
    return [];
  }

  // Create a single layer from scalar data
  const layer: StratumLayer = {
    id: uuidv4(),
    description: scalarData.stratum_description || '',
    depth_from_m: scalarData.stratum_depth_from || null,
    depth_to_m: scalarData.stratum_depth_to || null,
    thickness_m: scalarData.stratum_thickness_m || null,
    return_water_colour: scalarData.return_water_colour || null,
    water_loss: scalarData.water_loss || null,
    borehole_diameter: scalarData.borehole_diameter || null,
    remarks: null,
    samples: []
  };

  // If sample data exists, create a sample point
  if (scalarData.sample_event_type || scalarData.sample_event_depth_m) {
    const sample: StratumSamplePoint = {
      id: uuidv4(),
      sample_type: scalarData.sample_event_type || '',
      depth_mode: 'single',
      depth_single_m: scalarData.sample_event_depth_m || null,
      depth_from_m: null,
      depth_to_m: null,
      run_length_m: scalarData.run_length_m || null,
      spt_15cm_1: scalarData.spt_blows_per_15cm || null,
      spt_15cm_2: null,
      spt_15cm_3: null,
      n_value: scalarData.n_value_is_2131 ? parseInt(scalarData.n_value_is_2131) : null,
      total_core_length_cm: scalarData.total_core_length_cm || null,
      tcr_percent: scalarData.tcr_percent || null,
      rqd_length_cm: scalarData.rqd_length_cm || null,
      rqd_percent: scalarData.rqd_percent || null
    };

    layer.samples.push(sample);
  }

  return [layer];
}





