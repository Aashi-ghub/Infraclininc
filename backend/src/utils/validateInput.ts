import { z } from 'zod';
import { logger } from './logger';

export const GeologicalLogSchema = z.object({
  project_name: z.string(),
  client_name: z.string(),
  design_consultant: z.string(),
  job_code: z.string(),
  project_location: z.string(),
  chainage_km: z.number().optional(),
  area: z.string(),
  borehole_location: z.string(),
  borehole_number: z.string(),
  msl: z.string().optional(),
  method_of_boring: z.string(),
  diameter_of_hole: z.number(),
  commencement_date: z.string().transform((str) => new Date(str)),
  completion_date: z.string().transform((str) => new Date(str)),
  standing_water_level: z.number().optional(),
  termination_depth: z.number(),
  coordinate: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()]) // [longitude, latitude]
  }).optional(),
  type_of_core_barrel: z.string().optional(),
  bearing_of_hole: z.string().optional(),
  collar_elevation: z.number().optional(),
  logged_by: z.string(),
  checked_by: z.string(),
  lithology: z.string().optional(),
  rock_methodology: z.string().optional(),
  structural_condition: z.string().optional(),
  weathering_classification: z.string().optional(),
  fracture_frequency_per_m: z.number().optional(),
  size_of_core_pieces_distribution: z.record(z.string(), z.any()).optional(),
  remarks: z.string().optional(),
  created_by_user_id: z.string().uuid().nullable().optional()
});

export const BorelogDetailsSchema = z.object({
  borelog_id: z.string().uuid(),
  project_id: z.string().uuid().optional(), // Add optional project_id
  substructure_id: z.string().uuid().optional(), // Add optional substructure_id
  number: z.string(),
  msl: z.string().optional(),
  boring_method: z.string(),
  hole_diameter: z.number(),
  commencement_date: z.string().transform((str) => new Date(str)),
  completion_date: z.string().transform((str) => new Date(str)),
  standing_water_level: z.number().optional(),
  termination_depth: z.number(),
  coordinate: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([
      z.number().min(-180).max(180), // longitude
      z.number().min(-90).max(90)    // latitude
    ])
  }).optional(),
  stratum_description: z.string().optional(),
  stratum_depth_from: z.number(),
  stratum_depth_to: z.number(),
  stratum_thickness_m: z.number(),
  remarks: z.string().optional(),
  created_by_user_id: z.string().uuid().optional() // Made optional
}).refine(
  (data) => data.stratum_depth_from < data.stratum_depth_to,
  {
    message: "stratum_depth_from must be less than stratum_depth_to",
    path: ["stratum_depth_from"]
  }
).refine(
  (data) => data.stratum_thickness_m === (data.stratum_depth_to - data.stratum_depth_from),
  {
    message: "stratum_thickness_m must equal the difference between stratum_depth_to and stratum_depth_from",
    path: ["stratum_thickness_m"]
  }
).refine(
  (data) => new Date(data.commencement_date) <= new Date(data.completion_date),
  {
    message: "completion_date must be on or after commencement_date",
    path: ["completion_date"]
  });

export type GeologicalLogInput = z.infer<typeof GeologicalLogSchema>;
export type BorelogDetailsInput = z.infer<typeof BorelogDetailsSchema>;

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; error?: string } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      logger.warn('Validation error', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
    logger.error('Unexpected validation error', { error });
    return { success: false, error: 'Internal validation error' };
  }
} 