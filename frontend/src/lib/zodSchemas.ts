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
  created_by_user_id: z.string().uuid().optional(),
});

// Borelog Details Schema
export const borelogDetailSchema = z.object({
  borelog_id: z.string().min(1, 'Borelog ID is required'),
  depth: z.number().min(0, 'Depth must be a positive number'),
  sample_type: z.string().min(1, 'Sample type is required'),
  sample_number: z.string().min(1, 'Sample number is required'),
  description: z.string().min(1, 'Description is required'),
  soil_type: z.string().optional(),
  moisture_content: z.number().optional(),
  plasticity: z.string().optional(),
  consistency: z.string().optional(),
  color: z.string().optional(),
  additional_notes: z.string().optional(),
});

// Project Schema
export const projectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Project name is required'),
  client: z.string().min(1, 'Client name is required'),
  location: z.string().min(1, 'Location is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  status: z.enum(['active', 'completed', 'on-hold']),
  description: z.string().optional(),
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

// Types derived from schemas
export type GeologicalLogFormData = z.infer<typeof geologicalLogSchema>;
export type BorelogDetailFormData = z.infer<typeof borelogDetailSchema>;
export type LabTestFormData = z.infer<typeof labTestSchema>;
export type ProjectFormData = z.infer<typeof projectSchema>;
export type UserFormData = z.infer<typeof userSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;