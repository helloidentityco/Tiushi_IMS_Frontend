import axios from 'axios';

/**
 * Centralized Axios API Client
 * Configured with baseURL and withCredentials: true for HttpOnly JWT cookie exchange
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
