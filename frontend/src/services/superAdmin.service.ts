import { api } from "@/lib/api";
import type { AuditLog, SuperAdminStats } from "@/types/audit.types";
import type { ListParams, Paginated } from "@/types/common.types";

export const superAdminService = {
  stats(): Promise<SuperAdminStats> {
    return api.get<SuperAdminStats>("/super-admin/stats").then((r) => r.data);
  },

  auditLogs(params: ListParams): Promise<Paginated<AuditLog>> {
    return api.get<Paginated<AuditLog>>("/super-admin/audit-logs", { params }).then((r) => r.data);
  },
};
