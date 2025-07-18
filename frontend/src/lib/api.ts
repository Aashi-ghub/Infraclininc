import axios from 'axios';
import {
  GeologicalLog,
  CreateGeologicalLogInput,
  BorelogDetail,
  CreateBorelogDetailInput,
  Project,
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
      window.location.href = '/login';
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
  
  getByProject: (projectId: string) => 
    apiClient.get<ApiResponse<GeologicalLog[]>>(`/geological-log/project/${projectId}`),
  
  update: (id: string, data: Partial<CreateGeologicalLogInput>) => 
    apiClient.put<ApiResponse<GeologicalLog>>(`/geological-log/${id}`, data),
  
  delete: (id: string) => 
    apiClient.delete<ApiResponse<null>>(`/geological-log/${id}`),
  
  list: () => 
    apiClient.get<ApiResponse<GeologicalLog[]>>('/geological-log'),
};

// Borelog API - alias to geologicalLogApi for backward compatibility
export const borelogApi = {
  create: (data: any) => geologicalLogApi.create(data),
  getById: (id: string) => geologicalLogApi.getById(id),
  getByProject: (projectId: string) => geologicalLogApi.getByProject(projectId),
  update: (id: string, data: any) => geologicalLogApi.update(id, data),
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