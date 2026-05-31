import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8081';

const api = axios.create({ baseURL: BASE });

export const dashboard  = () => api.get('/api/dashboard').then(r => r.data);
export const syncGCC    = () => api.post('/api/sync').then(r => r.data);
export const syncLogs   = () => api.get('/api/sync/logs').then(r => r.data);

export const getJobs = (params) => api.get('/api/jobs', { params }).then(r => r.data);
export const getJob  = (id) => api.get(`/api/jobs/${id}`).then(r => r.data);

export const getTechnicians = (params) => api.get('/api/technicians', { params }).then(r => r.data);
export const getTechJobs    = (id) => api.get(`/api/technicians/${id}/jobs`).then(r => r.data);

export const assignJob   = (data) => api.post('/api/assignments', data).then(r => r.data);
export const unassignJob = (jobId) => api.delete(`/api/assignments/${jobId}`).then(r => r.data);

export const getPartRequests    = (params) => api.get('/api/part-requests', { params }).then(r => r.data);
export const createPartRequest  = (data)   => api.post('/api/part-requests', data).then(r => r.data);
export const updatePartRequest  = (id, status) => api.patch(`/api/part-requests/${id}`, null, { params: { status } }).then(r => r.data);

export const getLocalities    = () => api.get('/api/localities').then(r => r.data);
export const getProductGroups = () => api.get('/api/product-groups').then(r => r.data);

export const importExcel = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/api/import/excel', fd).then(r => r.data);
};

export default api;
