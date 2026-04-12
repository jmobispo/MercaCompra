import axios from 'axios';

/**
 * API base URL resolution (in priority order):
 *
 * 1. VITE_API_URL  — explicit override (e.g. https://api.yourdomain.com/api/v1)
 * 2. /api/v1       — relative path (default)
 *
 * Using a relative path means the browser calls the same host that served the
 * frontend. In development Vite proxies /api → http://localhost:8000.
 * In Docker production nginx proxies /api → http://backend:8000.
 * This makes the app work from any device on the local network without changing
 * any config — iPad, iPhone, Android just use http://<your-pc-ip>:5173.
 */
const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject Bearer token from localStorage on every request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Redirect to /login on 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
