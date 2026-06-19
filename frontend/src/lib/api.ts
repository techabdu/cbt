import axios, { AxiosError } from "axios";

import { getToken, clearAuth } from "@/lib/auth";

/**
 * Shared axios instance for the CBT API. The base URL points at the Laravel
 * backend; per-environment it is set via NEXT_PUBLIC_API_URL.
 */
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

// Attach the bearer token to every request when present.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Centralised response handling for auth-related status codes.
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;

    if (typeof window !== "undefined") {
      if (status === 401) {
        // Token expired or invalid — drop it and bounce to login.
        clearAuth();
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = "/login?expired=1";
        }
      } else if (status === 423) {
        // Force password change — redirect unless already there.
        if (!window.location.pathname.includes("change-password")) {
          window.location.href = "/change-password";
        }
      }
    }

    return Promise.reject(error);
  }
);
