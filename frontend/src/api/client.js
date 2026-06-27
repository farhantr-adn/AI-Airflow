/**
 * Centralized Axios client used by all API service modules.
 * Adds Authorization header from localStorage and forwards cookies for Emergent session auth.
 */
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({
  baseURL: API,
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("forge_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      const p = window.location.pathname;
      if (!p.startsWith("/login") && !p.startsWith("/signup") && p !== "/") {
        localStorage.removeItem("forge_token");
      }
    }
    return Promise.reject(err);
  }
);

export default client;
