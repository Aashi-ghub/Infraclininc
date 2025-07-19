// Geological Log Types
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
  commencement_date: string;
  completion_date: string;
  standing_water_level?: number;
  termination_depth: number;
  coordinate?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
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
  created_at: string;
  updated_at: string;
  created_by_user_id?: string | null;
  substructure_id?: string; // Added for UI functionality
}

// User and Authentication Types
export type UserRole = 'Admin' | 'Engineer' | 'Logger' | 'Viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface CreateGeologicalLogInput {
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
  commencement_date: string;
  completion_date: string;
  standing_water_level?: number;
  termination_depth: number;
  coordinate?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
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
  created_by_user_id: string | null; // Allow null value
}

// Borelog Details Types
export interface BorelogDetail {
  id: string;
  borelog_id: string;
  number: string;
  msl?: string;
  boring_method: string;
  hole_diameter: number;
  commencement_date: string;
  completion_date: string;
  standing_water_level?: number;
  termination_depth: number;
  coordinate?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  stratum_description?: string;
  stratum_depth_from: number;
  stratum_depth_to: number;
  stratum_thickness_m: number;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBorelogDetailInput {
  borelog_id: string;
  number: string;
  msl?: string;
  boring_method: string;
  hole_diameter: number;
  commencement_date: string;
  completion_date: string;
  standing_water_level?: number;
  termination_depth: number;
  coordinate?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  stratum_description?: string;
  stratum_depth_from: number;
  stratum_depth_to: number;
  stratum_thickness_m: number;
  remarks?: string;
}

// Project Types
export interface Project {
  id: string;
  name: string;
  client: string;
  location: string;
  start_date: string;
  end_date?: string;
  status: 'active' | 'completed' | 'on-hold';
  description?: string;
  created_at: string;
  updated_at: string;
}

// Lab Test Types
export interface LabTest {
  id: string;
  borelog_id: string;
  sample_id: string;
  test_type: string;
  test_date: string;
  results: Record<string, any>;
  technician: string;
  status: 'pending' | 'in-progress' | 'completed' | 'reviewed';
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLabTestInput {
  borelog_id: string;
  sample_id: string;
  test_type: string;
  test_date: string;
  results: Record<string, any>;
  technician: string;
  status: 'pending' | 'in-progress' | 'completed' | 'reviewed';
  remarks?: string;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: 'success' | 'error';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} 