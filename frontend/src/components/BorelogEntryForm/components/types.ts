import { z } from 'zod';
import { 
  Project,
  Structure,
  Borehole,
  User as BaseUser
} from '@/lib/types';

type UserRole = 'Admin' | 'Project Manager' | 'Site Engineer' | 'Approval Engineer';

interface User extends BaseUser {
  user_id: string;
  name: string;
  role: UserRole;
}

// Form data structure matching Excel layout
interface BorelogFormData {
  // Project Information (Excel rows 3-8)
  project_id: string;
  structure_id: string;
  borehole_id: string;
  job_code: string;
  section_name: string;
  coordinate_e: string;
  coordinate_l: string;
  chainage_km?: number | null;
  location: string;
  msl?: number | null;
  method_of_boring: string;
  diameter_of_hole: string;
  commencement_date: string;
  completion_date: string;
  standing_water_level?: number | null;
  termination_depth?: number | null;
  
  // Test Counts (calculated fields)
  permeability_tests_count: number;
  spt_vs_tests_count: number;
  undisturbed_samples_count: number;
  disturbed_samples_count: number;
  water_samples_count: number;
  
  // Stratum rows (dynamic)
  stratum_rows: StratumRow[];
  
  // Metadata
  version_number: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  
  // Optional fields for form state
  edited_by?: string;
  editor_name?: string;
  submission_timestamp?: string;
  previous_version_id?: string;
  last_saved?: string;
  is_auto_save?: boolean;
}

interface StratumRow {
  id: string;
  
  // Parent-child relationship
  parent_id?: string | null; // null for main stratum rows, parent's id for subdivisions
  is_subdivision: boolean;  // true for subdivision rows, false for main stratum rows
  subdivision_number?: number | null; // null for main rows, 1,2,3... for subdivisions
  is_collapsed?: boolean; // true if parent row's subdivisions are hidden
  
  // Main description
  description: string;
  
  // Depth columns
  depth_from?: number | null;
  depth_to?: number | null;
  thickness?: number | null; // calculated: depth_to - depth_from
  
  // Sample/Event columns
  sample_type: string;
  sample_depth?: number | null;
  run_length?: number | null;
  
  // SPT columns
  spt_15cm_1?: number | null;
  spt_15cm_2?: number | null;
  spt_15cm_3?: number | null;
  n_value?: number | null; // calculated: sum of SPT values
  
  // Core columns
  total_core_length?: number | null;
  tcr_percent?: number | null; // calculated: (total_core_length / run_length) * 100
  rqd_length?: number | null;
  rqd_percent?: number | null; // calculated: (rqd_length / run_length) * 100
  
  // Other columns
  return_water_color?: string;
  water_loss?: string;
  borehole_diameter?: string;
  remarks?: string;
}

// Validation schema
const stratumRowSchema = z.object({
  id: z.string(),
  parent_id: z.string().nullable().optional(),
  is_subdivision: z.boolean(),
  subdivision_number: z.number().nullable().optional(),
  description: z.string(),
  depth_from: z.number().nullable().optional(),
  depth_to: z.number().nullable().optional(),
  thickness: z.number().nullable().optional(),
  sample_type: z.string(),
  sample_depth: z.number().nullable().optional(),
  run_length: z.number().nullable().optional(),
  spt_15cm_1: z.number().nullable().optional(),
  spt_15cm_2: z.number().nullable().optional(),
  spt_15cm_3: z.number().nullable().optional(),
  n_value: z.number().nullable().optional(),
  total_core_length: z.number().nullable().optional(),
  tcr_percent: z.number().nullable().optional(),
  rqd_length: z.number().nullable().optional(),
  rqd_percent: z.number().nullable().optional(),
  return_water_color: z.string().optional(),
  water_loss: z.string().optional(),
  borehole_diameter: z.string().optional(),
  remarks: z.string().optional(),
  is_collapsed: z.boolean().optional(),
});

const borelogFormSchema = z.object({
  project_id: z.string().min(1, 'Project is required'),
  structure_id: z.string().min(1, 'Structure is required'),
  borehole_id: z.string().min(1, 'Borehole is required'),
  job_code: z.string().min(1, 'Job code is required'),
  section_name: z.string().min(1, 'Section name is required'),
  coordinate_e: z.string().min(1, 'Easting coordinate is required'),
  coordinate_l: z.string().min(1, 'Northing coordinate is required'),
  chainage_km: z.number().nullable().optional(),
  location: z.string().min(1, 'Location is required'),
  msl: z.number().nullable().optional(),
  method_of_boring: z.string().min(1, 'Method of boring is required'),
  diameter_of_hole: z.string().min(1, 'Diameter of hole is required'),
  commencement_date: z.string().min(1, 'Commencement date is required'),
  completion_date: z.string().min(1, 'Completion date is required'),
  standing_water_level: z.number().nullable().optional(),
  termination_depth: z.number().nullable().optional(),
  permeability_tests_count: z.number(),
  spt_vs_tests_count: z.number(),
  undisturbed_samples_count: z.number(),
  disturbed_samples_count: z.number(),
  water_samples_count: z.number(),
  stratum_rows: z.array(stratumRowSchema),
  version_number: z.number(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected']),
  edited_by: z.string().optional(),
  editor_name: z.string().optional(),
  submission_timestamp: z.string().optional(),
  previous_version_id: z.string().optional(),
  last_saved: z.string().optional(),
  is_auto_save: z.boolean().optional(),
});

interface BorelogEntryFormProps {
  projectId?: string;
  structureId?: string;
  boreholeId?: string;
  borelogId?: string; // For editing existing borelog
}

export type {
  Structure,
  User,
  UserRole,
  BorelogFormData,
  StratumRow,
  BorelogEntryFormProps,
  Project,
  Borehole
};

export {
  stratumRowSchema,
  borelogFormSchema
};
