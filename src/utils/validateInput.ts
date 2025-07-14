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
  created_by_user_id: z.string().uuid()
});

export const BorelogDetailsSchema = z.object({
  borelog_id: z.string().uuid(),
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
    coordinates: z.tuple([z.number(), z.number()]) // [longitude, latitude]
  }).optional(),
  stratum_description: z.string().optional(),
  stratum_depth_from: z.number(),
  stratum_depth_to: z.number(),
  stratum_thickness_m: z.number(),
  remarks: z.string().optional(),
  created_by_user_id: z.string().uuid()
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