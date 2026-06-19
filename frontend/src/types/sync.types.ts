export type SyncDirection = "push" | "pull";
export type SyncStatus = "pending" | "success" | "failed";

export interface SyncLog {
  id: number;
  exam_id: number | null;
  direction: SyncDirection;
  status: SyncStatus;
  initiated_by: number | null;
  target_server_url: string | null;
  payload_summary: Record<string, unknown> | null;
  synced_at: string | null;
  error_message: string | null;
  created_at: string;
}
