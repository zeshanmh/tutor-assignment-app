import axios from 'axios';

// In production, if REACT_APP_API_URL is not set, use relative path (same domain)
// In development, default to localhost
const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5000/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 403 errors (authentication/authorization failures)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      console.error('403 Forbidden - Authentication failed:', error.response?.data);
      // Clear token and redirect to login if we get a 403
      localStorage.removeItem('token');
      localStorage.removeItem('email');
      // Only redirect if we're not already on the login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  requestCode: (email) => api.post('/auth/request-code', { email }),
  verifyCode: (email, code) => api.post('/auth/verify-code', { email, code }),
  logout: () => api.post('/auth/logout'),
};

// Student endpoints
export const studentsAPI = {
  getAll: () => api.get('/students'),
  add: (student) => api.post('/students', student),
  update: (rowIndex, student) => api.put(`/students/${rowIndex}`, student),
  delete: (rowIndex) => api.delete(`/students/${rowIndex}`),
  restore: (student, rowIndex) => api.post('/students/restore', { student, row_index: rowIndex }),
  bulkAdd: (students) => api.post('/students/bulk', { students }),
};

// NRT endpoints
export const nrtsAPI = {
  getAll: () => api.get('/nrts'),
  add: (nrt) => api.post('/nrts', nrt),
  update: (rowIndex, nrt) => api.put(`/nrts/${rowIndex}`, nrt),
  delete: (rowIndex) => api.delete(`/nrts/${rowIndex}`),
  bulkAdd: (nrts) => api.post('/nrts/bulk', { nrts }),
};

// RT endpoints
export const rtsAPI = {
  getAll: () => api.get('/rts'),
  add: (rt) => api.post('/rts', rt),
  update: (rowIndex, rt) => api.put(`/rts/${rowIndex}`, rt),
  delete: (rowIndex) => api.delete(`/rts/${rowIndex}`),
};

// Assignment endpoints
export const assignmentsAPI = {
  assignRT: (studentRowIndex, rtEmail) => 
    api.post('/assignments/assign-rt', { student_row_index: studentRowIndex, rt_email: rtEmail }),
  removeRT: (studentRowIndex) => 
    api.post('/assignments/remove-rt', { student_row_index: studentRowIndex }),
  assignNRT: (studentRowIndex, nrtEmail) => 
    api.post('/assignments/assign-nrt', { student_row_index: studentRowIndex, nrt_email: nrtEmail }),
  removeNRT: (studentRowIndex) => 
    api.post('/assignments/remove-nrt', { student_row_index: studentRowIndex }),
};

// Email endpoints
export const emailAPI = {
  send: (studentRowIndex, emailTemplate) => 
    api.post('/email/send', { student_row_index: studentRowIndex, email_template: emailTemplate }),
  sendBulk: (studentRowIndices, emailTemplate) => 
    api.post('/email/send-bulk', { student_row_indices: studentRowIndices, email_template: emailTemplate }),
  preview: (studentId, templateName, additionalCc) => 
    api.post('/email/preview', { student_id: studentId, template_name: templateName, additional_cc: additionalCc }),
  sendTemplate: (studentId, templateName, additionalCc) => 
    api.post('/email/send-template', { student_id: studentId, template_name: templateName, additional_cc: additionalCc }),
  getHistory: (studentId) => api.get(`/students/${studentId}/email-history`),
};

// Email Template endpoints
export const emailTemplatesAPI = {
  getAll: () => api.get('/email-templates'),
  create: (template) => api.post('/email-templates', template),
  update: (templateId, template) => api.put(`/email-templates/${templateId}`, template),
  delete: (templateId) => api.delete(`/email-templates/${templateId}`),
};

// Stats endpoint
export const statsAPI = {
  get: () => api.get('/stats'),
};

// Sync endpoints
export const syncAPI = {
  syncToSheets: (force = false) => api.post('/sync/to-sheets', { force }),
  syncFromSheets: (force = false) => api.post('/sync/from-sheets', { force }),
  getStatus: () => api.get('/sync/status'),
};

export default api;

