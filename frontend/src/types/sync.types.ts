export type SyncDirection = "push" | "pull";
export type SyncStatus = "pending" | "success" | "failed";

export interface SyncLog {
  id: number;
  exam_id: number | null;
  exam?: { id: number; course: string | null } | null;
  direction: SyncDirection;
  status: SyncStatus;
  initiated_by: string | null;
  target_server_url: string | null;
  payload_summary: Record<string, number> | null;
  synced_at: string | null;
  error_message: string | null;
  created_at: string;
}
