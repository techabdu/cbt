export interface AuditLog {
  id: number;
  action: string;
  model_type: string | null;
  model_id: number | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user: {
    id: number;
    name: string;
    file_number: string;
  } | null;
  created_at: string;
}

export interface SuperAdminStats {
  schools: number;
  students: number;
  cbt_admins: number;
  exam_officers: number;
  lecturers: number;
  active_users: number;
  is_offline_server: boolean;
  server_time: string;
}
