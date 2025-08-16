import { z } from 'zod';

// Geological Log Schema
export const geologicalLogSchema = z.object({
  project_name: z.string().min(1, 'Project name is required'),
  client_name: z.string().min(1, 'Client name is required'),
  design_consultant: z.string().min(1, 'Design consultant is required'),
  job_code: z.string().min(1, 'Job code is required'),
  project_location: z.string().min(1, 'Project location is required'),
  chainage_km: z.number().optional(),
  area: z.string().min(1, 'Area is required'),
  borehole_location: z.string().min(1, 'Borehole location is required'),
  borehole_number: z.string().min(1, 'Borehole number is required'),
  msl: z.string().optional(),
  method_of_boring: z.string().min(1, 'Method of boring is required'),
  diameter_of_hole: z.number().min(0, 'Diameter must be a positive number'),
  commencement_date: z.string().min(1, 'Commencement date is required'),
  completion_date: z.string().min(1, 'Completion date is required'),
  standing_water_level: z.number().optional(),
  termination_depth: z.number().min(0, 'Termination depth must be a positive number'),
  coordinate: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
  }).optional(),
  type_of_core_barrel: z.string().optional(),
  bearing_of_hole: z.string().optional(),
  collar_elevation: z.number().optional(),
  logged_by: z.string().min(1, 'Logged by is required'),
  checked_by: z.string().min(1, 'Checked by is required'),
  lithology: z.string().optional(),
  rock_methodology: z.string().optional(),
  structural_condition: z.string().optional(),
  weathering_classification: z.string().optional(),
  fracture_frequency_per_m: z.number().optional(),
  remarks: z.string().optional(),
  created_by_user_id: z.string().uuid().nullable().optional(),
});

// Borelog Details Schema
export const borelogDetailSchema = z.object({
  borelog_id: z.string().min(1, 'Borelog ID is required'),
  number: z.string().min(1, 'Number is required'),
  msl: z.string().optional(),
  boring_method: z.string().min(1, 'Boring method is required'),
  hole_diameter: z.number().min(0, 'Hole diameter must be a positive number'),
  commencement_date: z.string().min(1, 'Commencement date is required'),
  completion_date: z.string().min(1, 'Completion date is required'),
  standing_water_level: z.number().optional(),
  termination_depth: z.number().min(0, 'Termination depth must be a positive number'),
  coordinate: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
  }).optional(),
  stratum_description: z.string().optional(),
  stratum_depth_from: z.number().min(0, 'Depth from must be a positive number'),
  stratum_depth_to: z.number().min(0, 'Depth to must be a positive number'),
  stratum_thickness_m: z.number().min(0, 'Thickness must be a positive number'),
  remarks: z.string().optional(),
});

// Project Schema
export const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  location: z.string().optional(),
});

// Structure Schema
export const structureSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  type: z.enum(['Tunnel', 'Bridge', 'LevelCrossing', 'Viaduct', 'Embankment', 'Alignment', 'Yeard', 'StationBuilding', 'Building', 'SlopeStability']),
  description: z.string().optional(),
});

// Substructure Schema
export const substructureSchema = z.object({
  structure_id: z.string().uuid('Invalid structure ID'),
  project_id: z.string().uuid('Invalid project ID'),
  type: z.enum(['P1', 'P2', 'M', 'E', 'Abutment1', 'Abutment2', 'LC', 'Right side', 'Left side']),
  remark: z.string().optional(),
});

// User Assignment Schema
export const userAssignmentSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  assignment_type: z.enum(['AdminToManager', 'ManagerToTeam']),
  assigner: z.array(z.string().uuid('Invalid assigner ID')),
  assignee: z.array(z.string().uuid('Invalid assignee ID')),
});

// Lab Test Schema
export const labTestSchema = z.object({
  borelog_id: z.string().min(1, 'Borelog ID is required'),
  sample_id: z.string().min(1, 'Sample ID is required'),
  test_type: z.string().min(1, 'Test type is required'),
  test_date: z.string().min(1, 'Test date is required'),
  results: z.record(z.any()),
  technician: z.string().min(1, 'Technician is required'),
  status: z.enum(['pending', 'in-progress', 'completed', 'reviewed']),
  remarks: z.string().optional(),
});

// User Schema
export const userSchema = z.object({
  id: z.string().optional(),
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['Admin', 'Project Manager', 'Reviewer', 'Technician']),
});

// Login Schema
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Borelog Submission Schema
export const borelogSubmissionSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  structure_id: z.string().uuid('Invalid structure ID'),
  borehole_id: z.string().uuid('Invalid borehole ID'),
  version_number: z.number().min(1, 'Version number must be at least 1'),
  edited_by: z.string().uuid('Invalid user ID'),
  form_data: z.object({
    rows: z.array(z.object({
      id: z.string(),
      fields: z.array(z.object({
        id: z.string(),
        name: z.string(),
        value: z.union([z.string(), z.number(), z.null()]),
        fieldType: z.enum(['manual', 'calculated', 'auto-filled']),
        isRequired: z.boolean(),
        validation: z.object({
          min: z.number().optional(),
          max: z.number().optional(),
          pattern: z.string().optional()
        }).optional(),
        calculation: z.string().optional(),
        dependencies: z.array(z.string()).optional()
      })),
      description: z.string().optional(),
      isSubdivision: z.boolean().optional(),
      parentRowId: z.string().optional()
    })),
    metadata: z.object({
      project_name: z.string().min(1, 'Project name is required'),
      borehole_number: z.string().min(1, 'Borehole number is required'),
      commencement_date: z.string().min(1, 'Commencement date is required'),
      completion_date: z.string().min(1, 'Completion date is required'),
      standing_water_level: z.number().optional(),
      termination_depth: z.number().min(0, 'Termination depth must be positive')
    })
  }),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected'])
});

// Types derived from schemas
export type GeologicalLogFormData = z.infer<typeof geologicalLogSchema>;
export type BorelogDetailFormData = z.infer<typeof borelogDetailSchema>;
export type LabTestFormData = z.infer<typeof labTestSchema>;
export type ProjectFormData = z.infer<typeof projectSchema>;
export type StructureFormData = z.infer<typeof structureSchema>;
export type SubstructureFormData = z.infer<typeof substructureSchema>;
export type UserAssignmentFormData = z.infer<typeof userAssignmentSchema>;
export type UserFormData = z.infer<typeof userSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type BorelogSubmissionFormData = z.infer<typeof borelogSubmissionSchema>;