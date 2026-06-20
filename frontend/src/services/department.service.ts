import { api } from "@/lib/api";
import type { Paginated } from "@/types/common.types";
import type { Department } from "@/types/user.types";
import type { DepartmentInput } from "@/lib/validators";

export interface DepartmentWithCounts extends Department {
  courses_count: number;
  students_count: number;
}

export const departmentService = {
  list: (params?: Record<string, string | number | undefined>): Promise<Paginated<DepartmentWithCounts>> =>
    api.get("/exam-officer/departments", { params }).then((r) => r.data),

  create: (data: DepartmentInput): Promise<{ data: DepartmentWithCounts }> =>
    api.post("/exam-officer/departments", data).then((r) => r.data),

  update: (id: number, data: DepartmentInput): Promise<{ data: DepartmentWithCounts }> =>
    api.put(`/exam-officer/departments/${id}`, data).then((r) => r.data),

  remove: (id: number): Promise<void> =>
    api.delete(`/exam-officer/departments/${id}`),
};
