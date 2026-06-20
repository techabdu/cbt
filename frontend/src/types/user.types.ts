import type { Role } from "@/types/common.types";

export interface School {
  id: number;
  college_id: number;
  name: string;
  code: string;
  head_name: string | null;
}

export interface Department {
  id: number;
  school_id: number;
  name: string;
  code: string; // e.g. "CSC/MAT" for combined departments
  full_name: string | null;
}

export interface College {
  id: number;
  name: string;
  logo_path: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
}

export interface StaffUser {
  id: number;
  file_number: string;
  name: string;
  email: string | null;
  role: Role;
  role_label?: string;
  school_id: number | null;
  school?: School | null;
  department_id: number | null;
  department?: Department | null;
  is_active: boolean;
  last_login_at: string | null;
}
