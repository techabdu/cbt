import { api } from "@/lib/api";
import type { School } from "@/types/user.types";
import type { ListParams, Paginated } from "@/types/common.types";

export interface SchoolListItem extends School {
  departments_count?: number;
  students_count?: number;
  users_count?: number;
  created_at?: string;
}

export interface SchoolPayload {
  name: string;
  code: string;
  head_name: string | null;
}

export const schoolService = {
  list(params: ListParams): Promise<Paginated<SchoolListItem>> {
    return api.get<Paginated<SchoolListItem>>("/super-admin/schools", { params }).then((r) => r.data);
  },

  create(payload: SchoolPayload): Promise<School> {
    return api.post<{ data: School }>("/super-admin/schools", payload).then((r) => r.data.data);
  },

  update(id: number, payload: SchoolPayload): Promise<School> {
    return api.put<{ data: School }>(`/super-admin/schools/${id}`, payload).then((r) => r.data.data);
  },

  remove(id: number): Promise<void> {
    return api.delete(`/super-admin/schools/${id}`).then(() => undefined);
  },
};
