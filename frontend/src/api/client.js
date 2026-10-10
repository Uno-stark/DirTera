import axios from "axios";

// ─── Axios instance ──────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,   // 15 s hard timeout — fail fast instead of hanging forever
});

// ─── Token refresh state ─────────────────────────────────────────────────────
let isRefreshing = false;
let refreshPromise = null;

// ─── Request interceptor: attach bearer token ────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

// ─── Response interceptor: auto-refresh on 401 ───────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh for 401 errors, once per request
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Prevent refresh endpoint itself from triggering refresh loop
      if (originalRequest.url?.includes("/auth/refresh")) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login?error=session_expired";
        return Promise.reject(error);
      }

      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) {
        localStorage.removeItem("access_token");
        window.location.href = "/login?error=session_expired";
        return Promise.reject(error);
      }

      // Deduplicate concurrent refresh attempts
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = api
          .post("/api/v1/auth/refresh", { refresh_token: refreshToken })
          .then((response) => {
            const { access_token, refresh_token } = response.data;
            localStorage.setItem("access_token", access_token);
            localStorage.setItem("refresh_token", refresh_token);
            return access_token;
          })
          .catch((refreshError) => {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            window.location.href = "/login?error=session_expired";
            return Promise.reject(refreshError);
          })
          .finally(() => {
            isRefreshing = false;
            refreshPromise = null;
          });
      }

      try {
        const newToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;