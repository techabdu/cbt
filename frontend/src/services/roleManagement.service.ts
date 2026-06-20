import { api } from "@/lib/api";
import type { Paginated } from "@/types/common.types";
import type { StaffUser } from "@/types/user.types";
import type { RoleUpgrade } from "@/types/exam.types";

export const roleManagementService = {
  list: (params?: Record<string, string | number | undefined>): Promise<Paginated<StaffUser>> =>
    api.get("/cbt-admin/role-management", { params }).then((r) => r.data),

  history: (params?: Record<string, string | number | undefined>): Promise<Paginated<RoleUpgrade>> =>
    api.get("/cbt-admin/role-management/history", { params }).then((r) => r.data),

  promote: (userId: number, reason?: string): Promise<{ data: StaffUser }> =>
    api.post(`/cbt-admin/role-management/${userId}/promote`, { reason }).then((r) => r.data),

  demote: (userId: number, reason?: string): Promise<{ data: StaffUser }> =>
    api.post(`/cbt-admin/role-management/${userId}/demote`, { reason }).then((r) => r.data),
};
