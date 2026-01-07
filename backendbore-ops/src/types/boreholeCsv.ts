export interface BoreholeMetadata {
  project_name?: string | null;
  client_address?: string | null;
  website?: string | null;
  job_code?: string | null;
  section_name: string | null;
  chainage_km: number | string | null;
  location: string;
  borehole_no: string | null;
  commencement_date: string | null;
  completion_date: string | null;
  mean_sea_level: number | string | null;
  method_of_boring: string;
  diameter_of_hole: string;
  termination_depth: string;
  standing_water_level: string;
  coordinates?: {
    E?: number | string | null;
    L?: number | string | null;
  };
  lab_tests: {
    permeability_tests: number | string | null;
    sp_vs_tests: number | string | null;
    spt_tests: number | string | null;
    vs_tests: number | string | null;
    undisturbed_samples: number | string | null;
    disturbed_samples: number | string | null;
    water_samples: number | string | null;
  };
}

export interface SoilLayer {
  description: string;
  depth_from: number | string | null;
  depth_to: number | string | null;
  thickness: number | string | null;
  sample_id: string | null;
  sample_type?: string | null;
  sample_depth: number | string | null;
  run_length: number | string | null;
  penetration_15cm: (number | string | null)[];
  n_value: number | string | null;
  total_core_length_cm: number | string | null;
  tcr_percent: number | string | null;
  rqd_length_cm: number | string | null;
  rqd_percent: number | string | null;
  colour_of_return_water: string | null;
  water_loss: string | null;
  diameter_of_borehole: string | number | null;
  remarks: string | null;
}

export interface SampleRemark {
  sample_id: string | null;
  status: string | null;
}

export interface CoreQuality {
  tcr_percent: number | string | null;
  rqd_percent: number | string | null;
}

export interface BoreholeCsvData {
  metadata: BoreholeMetadata;
  layers: SoilLayer[];
  remarks: SampleRemark[];
  core_quality: CoreQuality;
}

export interface ParsedCsvRow {
  lineNumber: number;
  content: string;
  isHeader: boolean;
  isData: boolean;
  isMetadata: boolean;
}
