import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("forge_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      // do not auto-redirect from /login or callback
      const p = window.location.pathname;
      if (!p.startsWith("/login") && !p.startsWith("/signup") && p !== "/") {
        localStorage.removeItem("forge_token");
      }
    }
    return Promise.reject(err);
  }
);

export default api;
