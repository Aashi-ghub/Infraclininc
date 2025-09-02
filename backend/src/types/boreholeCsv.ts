export interface BoreholeMetadata {
  project_name: string;
  client_address: string;
  website: string;
  job_code: string;
  section_name: string | null;
  chainage_km: number | null;
  location: string;
  borehole_no: string | null;
  commencement_date: string;
  completion_date: string;
  mean_sea_level: number | null;
  method_of_boring: string;
  diameter_of_hole: string;
  termination_depth: string;
  standing_water_level: string;
  coordinates: {
    E: number | null;
    L: number | null;
  };
  lab_tests: {
    permeability_tests: number;
    sp_vs_tests: number;
    undisturbed_samples: number;
    disturbed_samples: string;
    water_samples: number;
  };
}

export interface SoilLayer {
  description: string;
  depth_from: number;
  depth_to: number;
  thickness: number;
  sample_id: string | null;
  sample_depth: number | null;
  run_length: number | null;
  penetration_15cm: (number | string)[];
  n_value: number | string | null;
  total_core_length_cm: number | null;
  tcr_percent: number | null;
  rqd_length_cm: number | null;
  rqd_percent: number | null;
  colour_of_return_water: string | null;
  water_loss: string | null;
  diameter_of_borehole: string | null;
  remarks: string | null;
}

export interface SampleRemark {
  sample_id: string;
  status: string;
}

export interface CoreQuality {
  tcr_percent: number | null;
  rqd_percent: number | null;
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
