import { api } from "@/lib/api";
import type { AuthUser } from "@/types/auth.types";
import type { ListParams, Paginated } from "@/types/common.types";

export interface CreateCbtAdminPayload {
  file_number: string;
  name: string;
  email: string | null;
}

export interface UpdateCbtAdminPayload {
  name: string;
  email: string | null;
  is_active: boolean;
}

export interface TempPasswordResult {
  user?: AuthUser;
  temp_password: string;
}

export const cbtAdminService = {
  list(params: ListParams): Promise<Paginated<AuthUser>> {
    return api.get<Paginated<AuthUser>>("/super-admin/cbt-admins", { params }).then((r) => r.data);
  },

  create(payload: CreateCbtAdminPayload): Promise<TempPasswordResult> {
    return api.post<TempPasswordResult>("/super-admin/cbt-admins", payload).then((r) => r.data);
  },

  update(id: number, payload: UpdateCbtAdminPayload): Promise<AuthUser> {
    return api.put<{ data: AuthUser }>(`/super-admin/cbt-admins/${id}`, payload).then((r) => r.data.data);
  },

  resetPassword(id: number): Promise<TempPasswordResult> {
    return api.post<TempPasswordResult>(`/super-admin/cbt-admins/${id}/reset-password`).then((r) => r.data);
  },

  deactivate(id: number): Promise<void> {
    return api.delete(`/super-admin/cbt-admins/${id}`).then(() => undefined);
  },
};
