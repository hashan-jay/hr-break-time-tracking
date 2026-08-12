import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5085/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hr_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const path = window.location.pathname;
      // Public portal must stay open without login.
      if (path.startsWith('/app')) {
        localStorage.removeItem('hr_token');
        localStorage.removeItem('hr_user');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
