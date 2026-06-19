import type { Role } from "@/types/common.types";

export interface AuthUser {
  id: number;
  file_number: string;
  name: string;
  email: string | null;
  role: Role;
  school_id: number | null;
  is_active: boolean;
  force_password_change: boolean;
  last_login_at: string | null;
}

export interface LoginCredentials {
  file_number: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface ChangePasswordPayload {
  current_password: string;
  password: string;
  password_confirmation: string;
}
