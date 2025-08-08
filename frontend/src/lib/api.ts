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
  PaginatedResponse
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
    if (error.response?.status === 401) {
      // Handle unauthorized
      localStorage.removeItem('auth_token');
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

export const borelogDetailsApi = {
  create: (data: CreateBorelogDetailInput) => 
    apiClient.post<ApiResponse<BorelogDetail>>('/borelog-details', data),
  
  getByBorelogId: (borelogId: string) => 
    apiClient.get<ApiResponse<BorelogDetail[]>>(`/borelog-details/${borelogId}`),
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