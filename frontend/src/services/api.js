import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Request interceptor - attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('login_time');
      sessionStorage.setItem('session_message', 'Sesi Anda telah berakhir. Silakan login kembali.');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  verify: () => api.get('/auth/verify'),
  getUsers: () => api.get('/auth/users'),
  updateUserStatus: (id, is_active) => api.put(`/auth/users/${id}/status`, { is_active }),
};

// ─── User API ─────────────────────────────────────────────────────────────────
export const userAPI = {
  getProfile: (userId) => api.get(`/users/profile/${userId}`),
  updateProfile: (userId, data) => api.put(`/users/profile/${userId}`, data),
  getAllProfiles: (params) => api.get('/users/all', { params }),
  createUser: (data) => api.post('/users/create', data),
  updateUser: (userId, data) => api.put(`/users/${userId}`, data),
  deleteUser: (userId) => api.delete(`/users/${userId}`),
  getAdminStats: () => api.get('/users/stats/admin'),
  downloadTemplate: () => api.get('/users/template', { responseType: 'blob' }),
  importExcel: (formData) => api.post('/users/import-excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// ─── Matkul / Course API ──────────────────────────────────────────────────────
export const courseAPI = {
  getAll: (params) => api.get('/courses', { params }),
  getById: (id, params) => api.get(`/courses/${id}`, { params }),
  getMyCourses: () => api.get('/courses/my-courses'),
  getAdminStats: () => api.get('/courses/stats/admin'),
  create: (data) => api.post('/courses', data),
  update: (id, data) => api.put(`/courses/${id}`, data),
  delete: (id) => api.delete(`/courses/${id}`),

  createSection: (data) => api.post('/courses/sections', data),
  updateSection: (id, data) => api.put(`/courses/sections/${id}`, data),
  deleteSection: (id) => api.delete(`/courses/sections/${id}`),

  uploadMaterial: (formData) => api.post('/courses/materials/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  downloadMaterial: (id) => api.get(`/courses/materials/${id}/download`, { responseType: 'blob' }),
  deleteMaterial: (id) => api.delete(`/courses/materials/${id}`),

  // Forum Announcements
  getAnnouncements: (courseId) => api.get(`/courses/${courseId}/announcements`),
  createAnnouncement: (courseId, formData) => api.post(`/courses/${courseId}/announcements`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteAnnouncement: (id) => api.delete(`/courses/announcements/${id}`),

  // Forum Comments
  getComments: (courseId, params) => api.get(`/courses/${courseId}/comments`, { params }),
  createComment: (courseId, data) => api.post(`/courses/${courseId}/comments`, data),
  deleteComment: (id) => api.delete(`/courses/comments/${id}`),

  // Course Access Rules (Whitelist)
  getAccessRules: (courseId) => api.get(`/courses/${courseId}/access-rules`),
  addAccessRule: (courseId, data) => api.post(`/courses/${courseId}/access-rules`, data),
  deleteAccessRule: (ruleId) => api.delete(`/courses/access-rules/${ruleId}`),
};

// ─── Enrollment API ───────────────────────────────────────────────────────────
export const enrollmentAPI = {
  enroll: (course_id) => api.post('/enrollments/enroll', { course_id }),
  getMyCourses: () => api.get('/enrollments/my-courses'),
  checkEnrollment: (courseId) => api.get(`/enrollments/check/${courseId}`),
  updateProgress: (data) => api.put('/enrollments/progress', data),
  getCourseProgress: (courseId) => api.get(`/enrollments/progress/${courseId}`),
  getCourseStudents: (courseId) => api.get(`/enrollments/students/${courseId}`),
};

// ─── Quiz API ─────────────────────────────────────────────────────────────────
export const quizAPI = {
  getAll: () => api.get('/quizzes'),
  getByCourse: (courseId) => api.get(`/quizzes/course/${courseId}`),
  getById: (id) => api.get(`/quizzes/${id}`),
  getMyAttempts: (quizId) => api.get(`/quizzes/${quizId}/my-attempts`),
  create: (data) => api.post('/quizzes', data),
  addQuestion: (data) => api.post('/quizzes/questions', data),
  submit: (data) => api.post('/quizzes/submit', data),
  togglePublish: (id, is_published) => api.put(`/quizzes/${id}/publish`, { is_published }),
};

export default api;
