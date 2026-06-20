import type { Department } from "@/types/user.types";

export interface Combination {
  id: number;
  school_id: number;
  name: string;
  code: string; // e.g. "CSC/MAT"
  departments?: Department[];
  students_count?: number;
  created_at?: string;
}

export interface AcademicSession {
  id: number;
  school_id: number;
  session: string; // e.g. "2024/2025"
  is_current: boolean;
  created_at?: string;
}
