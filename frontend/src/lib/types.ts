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
  // Approval fields
  is_approved?: boolean;
  approved_by?: string | null;
  approved_at?: string | null;
}

// User and Authentication Types
export type UserRole = 'Admin' | 'Project Manager' | 'Site Engineer' | 'Approval Engineer' | 'Lab Engineer' | 'Customer';

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
  standing_water_level?: number | null;
  termination_depth: number | null;
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
  project_id: string;
  name: string;
  location?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string;
  assigned_manager?: {
    user_id: string;
    name: string;
    email: string;
  };
}

export interface CreateProjectInput {
  name: string;
  location?: string;
  created_by?: string;
}

// Structure Types
export interface Structure {
  structure_id: string;
  project_id: string;
  type: 'Tunnel' | 'Bridge' | 'LevelCrossing' | 'Viaduct' | 'Embankment' | 'Alignment' | 'Yeard' | 'StationBuilding' | 'Building' | 'SlopeStability';
  description?: string;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string;
}

export interface CreateStructureInput {
  project_id: string;
  type: 'Tunnel' | 'Bridge' | 'LevelCrossing' | 'Viaduct' | 'Embankment' | 'Alignment' | 'Yeard' | 'StationBuilding' | 'Building' | 'SlopeStability';
  description?: string;
}

// Substructure Types
export interface Substructure {
  substructure_id: string;
  structure_id: string;
  project_id: string;
  type: 'P1' | 'P2' | 'M' | 'E' | 'Abutment1' | 'Abutment2' | 'LC' | 'Right side' | 'Left side';
  remark?: string;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string;
}

export interface CreateSubstructureInput {
  structure_id: string;
  project_id: string;
  type: 'P1' | 'P2' | 'M' | 'E' | 'Abutment1' | 'Abutment2' | 'LC' | 'Right side' | 'Left side';
  remark?: string;
}

// User Assignment Types
export interface UserAssignment {
  id: string;
  assignment_type: 'AdminToManager' | 'ManagerToTeam';
  project_id: string;
  assigner: string[];
  assignee: string[];
  created_at: string;
  updated_at: string;
  created_by_user_id?: string;
}

export interface AssignUsersInput {
  project_id: string;
  assignment_type: 'AdminToManager' | 'ManagerToTeam';
  assigner: string[];
  assignee: string[];
}

// Borelog Assignment Types
export interface BorelogAssignment {
  assignment_id: string;
  borelog_id?: string;
  structure_id?: string;
  substructure_id?: string;
  assigned_site_engineer: string;
  assigned_by: string;
  assigned_at: string;
  status: 'active' | 'inactive' | 'completed';
  notes?: string;
  expected_completion_date?: string;
  completed_at?: string;
  assigned_site_engineer_name?: string;
  assigned_site_engineer_email?: string;
  project_name?: string;
  structure_type?: string;
  substructure_type?: string;
}

export interface CreateBorelogAssignmentInput {
  borelog_id?: string;
  structure_id?: string;
  substructure_id?: string;
  assigned_site_engineer: string;
  notes?: string;
  expected_completion_date?: string;
}

export interface UpdateBorelogAssignmentInput {
  status?: 'active' | 'inactive' | 'completed';
  notes?: string;
  expected_completion_date?: string;
  completed_at?: string;
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

// Contact Types
export type ContactRole = 'Admin' | 'Project Manager' | 'Site Engineer' | 'Supervisor' | 'QA/QC';

export interface Contact {
  contact_id: string;
  organisation_id: string;
  name: string;
  role: ContactRole;
  date_created: string;
}

export interface CreateContactInput {
  organisation_id: string;
  name: string;
  role: ContactRole;
}

// Borelog Entry Form Types
export type FieldType = 'manual' | 'calculated' | 'auto-filled';

export interface BorelogField {
  id: string;
  name: string;
  value: string | number | null;
  fieldType: FieldType;
  isRequired: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  calculation?: string; // Formula for calculated fields
  dependencies?: string[]; // Field IDs this field depends on for calculation
}

export interface BorelogRow {
  id: string;
  fields: BorelogField[];
  description?: string;
  isSubdivision?: boolean;
  parentRowId?: string;
}

export interface BorelogSubmission {
  submission_id: string;
  project_id: string;
  structure_id: string;
  borehole_id: string;
  version_number: number;
  edited_by: string;
  timestamp: string;
  form_data: {
    rows: BorelogRow[];
    metadata: {
      project_name: string;
      borehole_number: string;
      commencement_date: string;
      completion_date: string;
      standing_water_level: number;
      termination_depth: number;
    };
  };
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
}

export interface BorelogFormState {
  project_id: string;
  structure_id: string;
  borehole_id: string;
  rows: BorelogRow[];
  metadata: {
    project_name: string;
    borehole_number: string;
    commencement_date: string;
    completion_date: string;
    standing_water_level: number;
    termination_depth: number;
  };
  lastSaved: string;
  version: number;
} 

// Borehole Types
export interface Borehole {
  borehole_id: string;
  project_id: string;
  structure_id?: string;
  substructure_id?: string;
  tunnel_no?: string;
  location?: string;
  chainage?: string;
  borehole_number: string;
  msl?: string;
  coordinate?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  coordinates?: {
    latitude?: number;
    longitude?: number;
    elevation?: number;
  };
  boring_method?: string;
  hole_diameter?: number;
  created_at: string;
  created_by_user_id?: string;
}

export interface CreateBoreholeInput {
  project_id: string;
  structure_id?: string;
  substructure_id?: string;
  tunnel_no?: string;
  location?: string;
  chainage?: string;
  borehole_number: string;
  msl?: string;
  coordinate?: {
    type: 'Point';
    coordinates: [number, number];
  };
  boring_method?: string;
  hole_diameter?: number;
  created_by_user_id?: string;
}

// Workflow Types
export interface WorkflowStatusData {
  borelog_id: string;
  current_status: string;
  version_number: number;
  submitted_by?: string;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  returned_by?: string;
  returned_at?: string;
  submission_comments?: string;
  review_comments?: string;
  lab_tests: any[];
}

export interface PendingReview {
  borelog_id: string;
  version_no: number;
  status: string;
  submitted_by: string;
  submitted_at: string;
  submission_comments?: string;
  project_name: string;
  substructure_name?: string;
  submitted_by_name?: string;
}

export interface LabTestAssignment {
  id: string;
  borelog_id: string;
  sample_id: string;
  test_type: string;
  priority: 'low' | 'medium' | 'high';
  expected_completion_date: string;
  status: string;
  assigned_at: string;
  project_name: string;
  borehole_number: string;
}

export interface WorkflowStatistics {
  projects: Array<{
    project_id: string;
    project_name: string;
    total_borelogs: string;
    draft_count: string;
    submitted_count: string;
    approved_count: string;
    rejected_count: string;
    returned_count: string;
  }>;
  totals: {
    total_borelogs: number;
    draft_count: number;
    submitted_count: number;
    approved_count: number;
    rejected_count: number;
    returned_count: number;
  };
} 

// Lab Report Management Types
export interface LabRequest {
  id: string;
  borelog_id: string;
  sample_id: string;
  requested_by: string;
  requested_date: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  test_type: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  due_date?: string;
  notes?: string;
  borelog: {
    borehole_number: string;
    project_name: string;
    chainage?: string;
  };
}

export interface LabReport {
  id: string;
  request_id: string;
  borelog_id: string;
  sample_id: string;
  test_type: string;
  results: string;
  file_url?: string;
  submitted_by: string;
  submitted_at: string;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';
  version: number;
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  rejection_comments?: string;
  borelog: {
    borehole_number: string;
    project_name: string;
    chainage?: string;
  };
}

export interface CreateLabReportInput {
  request_id: string;
  test_type: string;
  results: string;
  file?: File;
}

export interface ReviewLabReportInput {
  status: 'Approved' | 'Rejected';
  comments?: string;
}

export interface LabTestType {
  id: string;
  name: string;
  category: string;
  description?: string;
  standard_method?: string;
}

// Lab Report Status Badge Variants
export const getLabReportStatusVariant = (status: LabReport['status']) => {
  switch (status) {
    case 'Draft': return 'secondary';
    case 'Submitted': return 'outline';
    case 'Under Review': return 'default';
    case 'Approved': return 'default';
    case 'Rejected': return 'destructive';
    default: return 'secondary';
  }
};

export const getLabRequestStatusVariant = (status: LabRequest['status']) => {
  switch (status) {
    case 'Pending': return 'secondary';
    case 'In Progress': return 'default';
    case 'Completed': return 'default';
    case 'Cancelled': return 'destructive';
    default: return 'secondary';
  }
}; 