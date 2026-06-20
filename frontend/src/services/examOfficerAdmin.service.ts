import { api } from "@/lib/api";
import type { AuthUser } from "@/types/auth.types";
import type { School } from "@/types/user.types";
import type { ListParams, Paginated } from "@/types/common.types";

export interface CreateExamOfficerPayload {
  file_number: string;
  name: string;
  email: string | null;
  school_id: number;
}

export interface UpdateExamOfficerPayload {
  name: string;
  email: string | null;
  is_active: boolean;
}

export interface TempPasswordResult {
  user?: AuthUser;
  temp_password: string;
}

/**
 * CBT Admin management of School Exam Officers. CBT Admin creates officer
 * accounts directly and assigns each to a school (schools are owned by the
 * Super Admin and exposed read-only here for the picker).
 */
export const examOfficerAdminService = {
  list(params: ListParams): Promise<Paginated<AuthUser>> {
    return api.get<Paginated<AuthUser>>("/cbt-admin/exam-officers", { params }).then((r) => r.data);
  },

  create(payload: CreateExamOfficerPayload): Promise<TempPasswordResult> {
    return api.post<TempPasswordResult>("/cbt-admin/exam-officers", payload).then((r) => r.data);
  },

  update(id: number, payload: UpdateExamOfficerPayload): Promise<AuthUser> {
    return api.put<{ data: AuthUser }>(`/cbt-admin/exam-officers/${id}`, payload).then((r) => r.data.data);
  },

  resetPassword(id: number): Promise<TempPasswordResult> {
    return api.post<TempPasswordResult>(`/cbt-admin/exam-officers/${id}/reset-password`).then((r) => r.data);
  },

  deactivate(id: number): Promise<void> {
    return api.delete(`/cbt-admin/exam-officers/${id}`).then(() => undefined);
  },

  schools(): Promise<School[]> {
    return api.get<{ data: School[] }>("/cbt-admin/schools").then((r) => r.data.data);
  },
};
