import axios from 'axios';
import {
  GeologicalLog,
  CreateGeologicalLogInput,
  BorelogDetail,
  CreateBorelogDetailInput,
  Project,
  CreateProjectInput,
  Structure,
  CreateStructureInput,
  Substructure,
  CreateSubstructureInput,
  UserAssignment,
  AssignUsersInput,
  BorelogAssignment,
  CreateBorelogAssignmentInput,
  UpdateBorelogAssignmentInput,
  LabTest,
  CreateLabTestInput,
  LabRequest,
  LabReport,
  CreateLabReportInput,
  ReviewLabReportInput,
  ApiResponse,
  PaginatedResponse,
  BorelogSubmission,
  Borehole,
  CreateBoreholeInput,

  WorkflowStatusData,
  PendingReview,
  LabTestAssignment,
  WorkflowStatistics
} from './types';

// Get API base URL from environment variables
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/dev";

// Create axios instance with default config
export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth tokens (if needed)
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only handle 401s from non-auth endpoints
    if (error.response?.status === 401 && !error.config.url?.includes('/auth/')) {
      // Handle unauthorized
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_email');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const geologicalLogApi = {
  create: (data: CreateGeologicalLogInput) => 
    apiClient.post<ApiResponse<GeologicalLog>>('/geological-log', data),
  
  getById: (id: string) => 
    apiClient.get<ApiResponse<GeologicalLog>>(`/geological-log/${id}`),
  
  getByProject: (projectName: string) => 
    apiClient.get<ApiResponse<GeologicalLog[]>>(`/geological-log/project-name/${encodeURIComponent(projectName)}`),
  
  getByProjectWithSubstructures: (projectName: string) => 
    apiClient.get<ApiResponse<GeologicalLog[]>>(`/geological-log/project-name/${encodeURIComponent(projectName)}/with-substructures`),
  
  update: (id: string, data: Partial<CreateGeologicalLogInput>) => 
    apiClient.put<ApiResponse<GeologicalLog>>(`/geological-log/${id}`, data),
  
  updateSubstructure: (id: string, substructure_id: string | null) => 
    apiClient.put<ApiResponse<GeologicalLog>>(`/geological-log/${id}/substructure`, { substructure_id }),
  
  delete: (id: string) => 
    apiClient.delete<ApiResponse<null>>(`/geological-log/${id}`),
  
  list: () => 
    apiClient.get<ApiResponse<GeologicalLog[]>>('/geological-log'),
  
  // New approval and CSV upload endpoints
  approve: (id: string, data: { is_approved: boolean; version_no?: number; remarks?: string }) => 
    apiClient.post<ApiResponse<GeologicalLog>>(`/borelog/${id}/approve`, data),
  
  uploadCSV: (data: { csvData: string; projectId: string }) => 
    apiClient.post<ApiResponse<any>>('/borelog/upload-csv', data),
};

// Borelog API - alias to geologicalLogApi for backward compatibility
export const borelogApi = {
  create: (data: any) => geologicalLogApi.create(data),
  getById: (id: string) => geologicalLogApi.getById(id),
  getByProject: (projectName: string) => geologicalLogApi.getByProject(projectName),
  update: (id: string, data: any) => {
    // Check if the update is only for substructure_id
    if (Object.keys(data).length === 1 && 'substructure_id' in data) {
      return geologicalLogApi.updateSubstructure(id, data.substructure_id);
    }
    return geologicalLogApi.update(id, data);
  },
  delete: (id: string) => geologicalLogApi.delete(id),
  list: () => geologicalLogApi.list(),
};

// Actual Borelog API for borelog management
export const actualBorelogApi = {
  getByProject: (projectId: string) => 
    apiClient.get<ApiResponse<any>>(`/projects/${projectId}/borelogs`),
  
  getFormData: (params?: { project_id?: string; structure_id?: string }) => {
    const queryParams = params ? new URLSearchParams(params).toString() : '';
    return apiClient.get<ApiResponse<any>>(`/borelog-form-data${queryParams ? `?${queryParams}` : ''}`);
  },
};

export const borelogDetailsApi = {
  create: (data: CreateBorelogDetailInput) => 
    apiClient.post<ApiResponse<BorelogDetail>>('/borelog-details', data),
  
  getByBorelogId: (borelogId: string) => 
    apiClient.get<ApiResponse<BorelogDetail[]>>(`/borelog-details/${borelogId}`),
};

// New borelog API endpoints
export const borelogApiV2 = {
  // Create new borelog (creates both boreloge and borelog_details)
  create: (data: any) => 
    apiClient.post<ApiResponse<any>>('/borelog', data),
  
  // Create new borelog details with version control
  createDetails: (data: any) => 
    apiClient.post<ApiResponse<any>>('/borelog-details', data),
  
  // Create new version of existing borelog
  createVersion: (data: any) => 
    apiClient.post<ApiResponse<any>>('/borelog/version', data),
  
  // Get borelog details with version history
  getDetailsByBorelogId: (borelogId: string) => 
    apiClient.get<ApiResponse<any>>(`/borelog-details/${borelogId}`),
  
  // Get borelog by substructure_id with version history
  getBySubstructureId: (substructureId: string) => 
    apiClient.get<ApiResponse<any>>(`/borelog/substructure/${substructureId}`),
  
  // Get all borelogs for a project with latest details
  getByProject: (projectId: string) => 
    apiClient.get<ApiResponse<any>>(`/projects/${projectId}/borelogs`),
  
  // Get form data (projects, structures, substructures)
  getFormData: (params?: { project_id?: string; structure_id?: string }) => {
    const queryParams = params ? new URLSearchParams(params).toString() : '';
    return apiClient.get<ApiResponse<any>>(`/borelog-form-data${queryParams ? `?${queryParams}` : ''}`);
  },

  // Approve version
  approve: (borelogId: string, data: { version_no: number; approved_by: string; approval_comments: string }) => 
    apiClient.post<ApiResponse<any>>(`/borelog/${borelogId}/approve`, data),

  // Reject version
  reject: (borelogId: string, data: { version_no: number; rejected_by: string; rejection_comments: string }) => 
    apiClient.post<ApiResponse<any>>(`/borelog/${borelogId}/reject`, data),
    
  // Stratum data endpoints
  saveStratumData: (data: { borelog_id: string; version_no: number; layers: any[]; user_id: string }) => 
    apiClient.post<ApiResponse<any>>('/stratum-data', data),
    
  getStratumData: (borelogId: string, versionNo: number) => 
    apiClient.get<ApiResponse<any>>(`/stratum-data?borelog_id=${borelogId}&version_no=${versionNo}`),
};

export const projectApi = {
  list: () => 
    apiClient.get<ApiResponse<Project[]>>('/projects'),
  
  getById: (id: string) => 
    apiClient.get<ApiResponse<Project>>(`/projects/${id}`),
  
  create: (data: CreateProjectInput) => 
    apiClient.post<ApiResponse<Project>>('/projects', data),
};

export const structureApi = {
  list: (projectId: string) => 
    apiClient.get<ApiResponse<Structure[]>>(`/structures?project_id=${projectId}`),
  
  create: (data: CreateStructureInput) => 
    apiClient.post<ApiResponse<Structure>>('/structures', data),
  
  getById: (id: string) => 
    apiClient.get<ApiResponse<Structure>>(`/structures/${id}`),
  
  update: (id: string, data: Partial<CreateStructureInput>) =>
    apiClient.put<ApiResponse<Structure>>(`/structures/${id}`, data),
};

export const substructureApi = {
  list: (projectId: string, structureId?: string) => {
    const params = new URLSearchParams({ project_id: projectId });
    if (structureId) params.append('structure_id', structureId);
    return apiClient.get<ApiResponse<Substructure[]>>(`/substructures?${params.toString()}`);
  },
  
  create: (data: CreateSubstructureInput) => 
    apiClient.post<ApiResponse<Substructure>>('/substructures', data),
  
  getById: (id: string) => 
    apiClient.get<ApiResponse<Substructure>>(`/substructures/${id}`),
};

export const assignmentApi = {
  assignUsers: (data: AssignUsersInput) =>
    apiClient.post<ApiResponse<UserAssignment>>('/assignments', data),
};

export const borelogAssignmentApi = {
  create: (data: CreateBorelogAssignmentInput) =>
    apiClient.post<ApiResponse<BorelogAssignment>>('/borelog-assignments', data),
  
  update: (assignmentId: string, data: UpdateBorelogAssignmentInput) =>
    apiClient.put<ApiResponse<BorelogAssignment>>(`/borelog-assignments/${assignmentId}`, data),
  
  getByBorelogId: (borelogId: string) =>
    apiClient.get<ApiResponse<BorelogAssignment[]>>(`/borelog-assignments/borelog/${borelogId}`),
  
  getByStructureId: (structureId: string) =>
    apiClient.get<ApiResponse<BorelogAssignment[]>>(`/borelog-assignments/structure/${structureId}`),
  
  getBySiteEngineer: (siteEngineerId: string) =>
    apiClient.get<ApiResponse<BorelogAssignment[]>>(`/borelog-assignments/site-engineer/${siteEngineerId}`),
  
  getActive: () =>
    apiClient.get<ApiResponse<BorelogAssignment[]>>('/borelog-assignments/active'),
  
  delete: (assignmentId: string) =>
    apiClient.delete<ApiResponse<null>>(`/borelog-assignments/${assignmentId}`),
};

export const userApi = {
  list: () => apiClient.get('/users'),
  getById: (id: string) => apiClient.get(`/users/${id}`),
};

export const authApi = {
  login: (data: { email: string; password: string }) => 
    apiClient.post('/auth/login', data),
  
  me: () => apiClient.get('/auth/me'),
};

// Workflow API
export const workflowApi = {
  // Submit borelog for review
  submitForReview: (borelogId: string, data: { 
    comments: string; 
    version_number: number; 
  }) => 
    apiClient.post<ApiResponse<any>>(`/workflow/${borelogId}/submit`, data),
  
  // Review borelog (approve/reject/return_for_revision)
  reviewBorelog: (borelogId: string, data: { 
    action: 'approve' | 'reject' | 'return_for_revision'; 
    comments: string; 
    version_number: number; 
  }) => 
    apiClient.post<ApiResponse<any>>(`/workflow/${borelogId}/review`, data),
  
  // Assign lab tests
  assignLabTests: (data: {
    borelog_id: string;
    sample_ids: string[];
    test_types: string[];
    assigned_lab_engineer: string;
    priority: 'low' | 'medium' | 'high';
    expected_completion_date: string;
  }) => 
    apiClient.post<ApiResponse<any>>('/workflow/lab-assignments', data),
  
  // Submit lab test results
  submitLabTestResults: (data: {
    assignment_id: string;
    sample_id: string;
    test_type: string;
    test_date: string;
    results: Record<string, any>;
    remarks?: string;
  }) => 
    apiClient.post<ApiResponse<any>>('/workflow/lab-results', data),
  
  // Get workflow status
  getWorkflowStatus: (borelogId: string) => 
    apiClient.get<ApiResponse<WorkflowStatusData>>(`/workflow/${borelogId}/status`),
  
  // Get pending reviews (for reviewers)
  getPendingReviews: () => 
    apiClient.get<ApiResponse<PendingReview[]>>('/workflow/pending-reviews'),
  
  // Get lab assignments (for lab engineers)
  getLabAssignments: () => 
    apiClient.get<ApiResponse<LabTestAssignment[]>>('/workflow/lab-assignments'),
  
  // Get workflow statistics (for project managers)
  getWorkflowStatistics: () => 
    apiClient.get<ApiResponse<WorkflowStatistics>>('/workflow/statistics'),
  
  // Get submitted borelogs (for site engineers)
  getSubmittedBorelogs: () => 
    apiClient.get<ApiResponse<any[]>>('/workflow/submitted-borelogs'),
};

export const labTestApi = {
  create: (data: CreateLabTestInput) => 
    apiClient.post<ApiResponse<LabTest>>('/lab-tests', data),
  
  list: () => 
    apiClient.get<ApiResponse<LabTest[]>>('/lab-tests'),
  
  getById: (id: string) => 
    apiClient.get<ApiResponse<LabTest>>(`/lab-tests/${id}`),
  
  getByProject: (projectId: string) => 
    apiClient.get<ApiResponse<LabTest[]>>(`/lab-tests/project/${projectId}`),
  
  getByBorelog: (borelogId: string) => 
    apiClient.get<ApiResponse<LabTest[]>>(`/lab-tests/borelog/${borelogId}`),
};

export const anomalyApi = {
  create: (data: any) => apiClient.post('/anomalies', data),
  list: () => apiClient.get('/anomalies'),
  update: (id: string, data: any) => apiClient.patch(`/anomalies/${id}`, data),
};

export const contactApi = {
  create: (data: any) => 
    apiClient.post('/contacts', data),
  
  list: () => 
    apiClient.get('/contacts'),
  
  getById: (id: string) => 
    apiClient.get(`/contacts/${id}`),
  
  getByOrganisation: (organisationId: string) => 
    apiClient.get(`/contacts/organisation/${organisationId}`),
  
  update: (id: string, data: any) => 
    apiClient.put(`/contacts/${id}`, data),
  
  delete: (id: string) => 
    apiClient.delete(`/contacts/${id}`),
};

// Borelog Images API
export const borelogImagesApi = {
  upload: (data: { borelog_id: string; image_url: string }) =>
    apiClient.post<ApiResponse<any>>('/borelog-images', data),

  getByBorelogId: (borelogId: string) =>
    apiClient.get<ApiResponse<any>>(`/borelog-images/${borelogId}`),

  delete: (imageId: string) =>
    apiClient.delete<ApiResponse<any>>(`/borelog-images/${imageId}`),
};

// Borelog Submission API
export const borelogSubmissionApi = {
  submit: async (data: Omit<BorelogSubmission, 'submission_id' | 'timestamp'>) => {
    const response = await apiClient.post('/borelog/submit', data);
    return response.data;
  },

  // Create new version instead of overwriting
  createVersion: async (data: any) => {
    const response = await apiClient.post('/borelog/create-version', data);
    return response.data;
  },

  // Save draft version
  saveDraft: async (data: any) => {
    const response = await apiClient.post('/borelog/save-draft', data);
    return response.data;
  },

  // Get version history for a borehole
  getVersionHistory: async (boreholeId: string) => {
    const response = await apiClient.get(`/borelog/versions/${boreholeId}`);
    return response.data;
  },

  // Get specific version
  getVersion: async (versionId: string) => {
    const response = await apiClient.get(`/borelog/version/${versionId}`);
    return response.data;
  },

  // Approve version
  approveVersion: async (versionId: string, data: { approved_by: string; approval_comments: string }) => {
    const response = await apiClient.post(`/borelog/version/${versionId}/approve`, data);
    return response.data;
  },

  // Reject version
  rejectVersion: async (versionId: string, data: { rejected_by: string; rejection_comments: string }) => {
    const response = await apiClient.post(`/borelog/version/${versionId}/reject`, data);
    return response.data;
  },

  getSubmissions: async (projectId: string, boreholeId: string) => {
    const response = await apiClient.get(`/borelog/submissions/${projectId}/${boreholeId}`);
    return response.data;
  },

  getSubmission: async (submissionId: string) => {
    const response = await apiClient.get(`/borelog/submission/${submissionId}`);
    return response.data;
  },

  updateSubmission: async (submissionId: string, data: Partial<BorelogSubmission>) => {
    const response = await apiClient.put(`/borelog/submission/${submissionId}`, data);
    return response.data;
  }
};

// Projects API - alias to projectApi for consistency
export const projectsApi = {
  list: () => projectApi.list(),
  getById: (id: string) => projectApi.getById(id),
  create: (data: CreateProjectInput) => projectApi.create(data),
};

// Structures API - alias to structureApi for consistency
export const structuresApi = {
  list: (projectId: string) => structureApi.list(projectId),
  create: (data: CreateStructureInput) => structureApi.create(data),
  getById: (id: string) => structureApi.getById(id),
  update: (id: string, data: Partial<CreateStructureInput>) => structureApi.update(id, data),
  getByProject: (projectId: string) => structureApi.list(projectId),
};

// Boreholes API
export const boreholesApi = {
  list: () => 
    apiClient.get<ApiResponse<Borehole[]>>('/boreholes'),
  
  getById: (id: string) => 
    apiClient.get<ApiResponse<Borehole>>(`/boreholes/${id}`),
  
  getByProject: (projectId: string) => 
    apiClient.get<ApiResponse<Borehole[]>>(`/boreholes/project/${projectId}`),
  
  getByProjectAndStructure: (projectId: string, structureId: string) => 
    apiClient.get<ApiResponse<Borehole[]>>(`/boreholes/project/${projectId}/structure/${structureId}`),
  
  create: (data: CreateBoreholeInput) => 
    apiClient.post<ApiResponse<Borehole>>('/boreholes', data),
  
  update: (id: string, data: Partial<CreateBoreholeInput>) => 
    apiClient.put<ApiResponse<Borehole>>(`/boreholes/${id}`, data),
  
  delete: (id: string) => 
    apiClient.delete<ApiResponse<null>>(`/boreholes/${id}`),
};

// Lab Test Results API
export const labTestResultsApi = {
  // Create new lab test result
  create: (data: {
    assignment_id: string;
    sample_id: string;
    test_type: string;
    test_date: string;
    results: any;
    technician: string;
    status: 'draft' | 'submitted' | 'approved' | 'rejected';
    remarks?: string;
  }) =>
    apiClient.post<ApiResponse<any>>('/lab-test-results', data),

  // Get lab test result by ID
  getById: (testId: string) =>
    apiClient.get<ApiResponse<any>>(`/lab-test-results/${testId}`),

  // Update lab test result
  update: (testId: string, data: {
    results?: any;
    status?: 'draft' | 'submitted' | 'approved' | 'rejected';
    remarks?: string;
  }) =>
    apiClient.put<ApiResponse<any>>(`/lab-test-results/${testId}`, data),

  // Get all lab test results with optional filters
  getAll: (params?: {
    status?: string;
    technician?: string;
    sample_id?: string;
    test_type?: string;
  }) =>
    apiClient.get<ApiResponse<any[]>>('/lab-test-results', { params }),

  // Delete lab test result
  delete: (testId: string) =>
    apiClient.delete<ApiResponse<null>>(`/lab-test-results/${testId}`),
};

// Unified Lab Reports API
export const unifiedLabReportsApi = {
  // Create new unified lab report
  create: (data: {
    assignment_id: string;
    borelog_id: string;
    sample_id: string;
    project_name: string;
    borehole_no: string;
    client: string;
    test_date: string;
    tested_by: string;
    checked_by: string;
    approved_by: string;
    test_types: string[];
    soil_test_data: any[];
    rock_test_data: any[];
    status: 'draft' | 'submitted' | 'approved' | 'rejected';
    remarks?: string;
  }) =>
    apiClient.post<ApiResponse<any>>('/unified-lab-reports', data),

  // Get unified lab report by ID
  getById: (reportId: string) =>
    apiClient.get<ApiResponse<any>>(`/unified-lab-reports/${reportId}`),

  // Update unified lab report
  update: (reportId: string, data: {
    soil_test_data?: any[];
    rock_test_data?: any[];
    test_types?: string[];
    status?: 'draft' | 'submitted' | 'approved' | 'rejected';
    remarks?: string;
    rejection_reason?: string;
  }) =>
    apiClient.put<ApiResponse<any>>(`/unified-lab-reports/${reportId}`, data),

  // Get all unified lab reports with optional filters
  getAll: (params?: {
    status?: string;
    tested_by?: string;
    sample_id?: string;
    borehole_no?: string;
    project_name?: string;
  }) =>
    apiClient.get<ApiResponse<any[]>>('/unified-lab-reports', { params }),

  // Delete unified lab report
  delete: (reportId: string) =>
    apiClient.delete<ApiResponse<null>>(`/unified-lab-reports/${reportId}`),
};

// Lab Report Version Control API
export const labReportVersionControlApi = {
  // Save draft version
  saveDraft: (data: any) => 
    apiClient.post<ApiResponse<any>>('/lab-reports/draft', data),

  // Submit for review
  submitForReview: (data: { report_id: string; version_no: number; submission_comments?: string }) => 
    apiClient.post<ApiResponse<any>>('/lab-reports/submit', data),

  // Review (approve/reject/return for revision)
  review: (reportId: string, data: { action: 'approve' | 'reject' | 'return_for_revision'; version_no: number; review_comments?: string }) => 
    apiClient.post<ApiResponse<any>>(`/lab-reports/${reportId}/review`, data),

  // Get version history
  getVersionHistory: (reportId: string) => 
    apiClient.get<ApiResponse<any>>(`/lab-reports/${reportId}/versions`),

  // Get specific version
  getVersion: (reportId: string, versionNo: number) => 
    apiClient.get<ApiResponse<any>>(`/lab-reports/${reportId}/version/${versionNo}`),
};

// Lab Report Management API
export const labReportApi = {
  // Lab Requests
  getRequests: () => 
    apiClient.get<ApiResponse<LabRequest[]>>('/lab-requests'),
  
  getRequestById: (id: string) => 
    apiClient.get<ApiResponse<LabRequest>>(`/lab-requests/${id}`),
  
  createRequest: (data: Omit<LabRequest, 'id' | 'requested_date' | 'status'>) => 
    apiClient.post<ApiResponse<LabRequest>>('/lab-requests', data),
  
  updateRequest: (id: string, data: Partial<LabRequest>) => 
    apiClient.put<ApiResponse<LabRequest>>(`/lab-requests/${id}`, data),
  
  deleteRequest: (id: string) => 
    apiClient.delete<ApiResponse<null>>(`/lab-requests/${id}`),
  
  // Lab Reports
  getReports: () => 
    apiClient.get<ApiResponse<LabReport[]>>('/lab-reports'),
  
  getReportById: (id: string) => 
    apiClient.get<ApiResponse<LabReport>>(`/lab-reports/${id}`),
  
  createReport: (data: CreateLabReportInput) => 
    apiClient.post<ApiResponse<LabReport>>('/lab-reports', data),
  
  updateReport: (id: string, data: Partial<CreateLabReportInput>) => 
    apiClient.put<ApiResponse<LabReport>>(`/lab-reports/${id}`, data),
  
  deleteReport: (id: string) => 
    apiClient.delete<ApiResponse<null>>(`/lab-reports/${id}`),
  
  // Review Reports
  reviewReport: (id: string, data: ReviewLabReportInput) => 
    apiClient.put<ApiResponse<LabReport>>(`/lab-reports/${id}/review`, data),
  
  // Get reports by status
  getReportsByStatus: (status: LabReport['status']) => 
    apiClient.get<ApiResponse<LabReport[]>>(`/lab-reports/status/${status}`),
  
  // Get reports by user role
  getReportsByRole: (role: string) => 
    apiClient.get<ApiResponse<LabReport[]>>(`/lab-reports/role/${role}`),
};