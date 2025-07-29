import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface LambdaHandler {
  (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult>;
}

export interface Point {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeologicalLog {
  borelog_id: string;
  project_name: string;
  client_name: string;
  design_consultant: string;
  job_code: string;
  project_location: string;
  chainage_km?: number;
  area: string;
  borehole_location: string;
  borehole_number: string;
  msl?: string;
  method_of_boring: string;
  diameter_of_hole: number;
  commencement_date: Date;
  completion_date: Date;
  standing_water_level?: number;
  termination_depth: number;
  coordinate?: Point;
  type_of_core_barrel?: string;
  bearing_of_hole?: string;
  collar_elevation?: number;
  logged_by: string;
  checked_by: string;
  lithology?: string;
  rock_methodology?: string;
  structural_condition?: string;
  weathering_classification?: string;
  fracture_frequency_per_m?: number;
  size_of_core_pieces_distribution?: Record<string, any>;
  remarks?: string;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
  // Approval fields
  is_approved?: boolean;
  approved_by?: string | null;
  approved_at?: Date | null;
}

export interface BorelogDetails {
  borelog_id: string;
  number: string;
  msl?: string;
  boring_method: string;
  hole_diameter: number;
  commencement_date: Date;
  completion_date: Date;
  standing_water_level?: number;
  termination_depth: number;
  coordinate?: Point;
  stratum_description?: string;
  stratum_depth_from: number;
  stratum_depth_to: number;
  stratum_thickness_m: number;
  remarks?: string;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
}

export const createResponse = (
  statusCode: number,
  body: ApiResponse
): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
  },
  body: JSON.stringify(body)
}); 