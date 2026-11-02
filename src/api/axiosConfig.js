import axios from 'axios';

/**
 * Base URL resolution with fallback to local development API
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * 1. Global Axios Defaults Configuration
 * Ensures any direct axios calls or new instances also default to withCredentials: true
 */
axios.defaults.withCredentials = true;
axios.defaults.baseURL = API_BASE_URL;

/**
 * 2. Centralized Axios API Client
 * Configured with baseURL and withCredentials: true for cross-origin HttpOnly JWT cookie exchange
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 3. Request Interceptor
 * - Enforces withCredentials: true on every outgoing request
 * - Attaches Bearer authorization token fallback from storage if available
 */
api.interceptors.request.use(
  (config) => {
    config.withCredentials = true;

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (token && !config.headers.Authorization && !config.headers.authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * 4. Response Interceptor
 * - Automatically caches authentication token upon login/refresh
 * - Cleans up cached credentials upon 401 Unauthorized
 */
api.interceptors.response.use(
  (response) => {
    const payload = response.data?.data || response.data;
    if (payload?.token && typeof window !== 'undefined') {
      localStorage.setItem('token', payload.token);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

/**
 * 5. Fetch API Wrapper Patch
 * Ensures any native window.fetch calls to API routes automatically include credentials
 */
if (typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch;
  window.fetch = function (resource, options = {}) {
    const urlStr = typeof resource === 'string' ? resource : (resource?.url || '');
    const isApiRequest =
      urlStr.startsWith('/') ||
      urlStr.includes('/api') ||
      urlStr.includes(':5000') ||
      urlStr.includes(API_BASE_URL);

    if (isApiRequest && !options.credentials) {
      options = {
        ...options,
        credentials: 'include',
      };

      const token = localStorage.getItem('token');
      if (token) {
        const headers = new Headers(options.headers || {});
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
          options.headers = headers;
        }
      }
    }

    return originalFetch(resource, options);
  };
}

export default api;
export { api };
