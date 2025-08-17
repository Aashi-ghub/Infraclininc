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
  LabTest,
  CreateLabTestInput,
  ApiResponse,
  PaginatedResponse,
  BorelogSubmission,
  Borehole,
  CreateBoreholeInput
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
  approve: (id: string, data: { is_approved: boolean; remarks?: string }) => 
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
  // Create new borelog details with version control
  createDetails: (data: any) => 
    apiClient.post<ApiResponse<any>>('/borelog-details', data),
  
  // Get borelog details with version history
  getDetailsByBorelogId: (borelogId: string) => 
    apiClient.get<ApiResponse<any>>(`/borelog-details/${borelogId}`),
  
  // Get all borelogs for a project with latest details
  getByProject: (projectId: string) => 
    apiClient.get<ApiResponse<any>>(`/projects/${projectId}/borelogs`),
  
  // Get form data (projects, structures, substructures)
  getFormData: (params?: { project_id?: string; structure_id?: string }) => {
    const queryParams = params ? new URLSearchParams(params).toString() : '';
    return apiClient.get<ApiResponse<any>>(`/borelog-form-data${queryParams ? `?${queryParams}` : ''}`);
  },
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

export const userApi = {
  list: () => apiClient.get('/users'),
  getById: (id: string) => apiClient.get(`/users/${id}`),
};

export const authApi = {
  login: (data: { email: string; password: string }) => 
    apiClient.post('/auth/login', data),
  
  me: () => apiClient.get('/auth/me'),
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