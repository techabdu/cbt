import { api } from "@/lib/api";
import type { Paginated } from "@/types/common.types";
import type { StaffUser } from "@/types/user.types";

type Params = Record<string, string | number | undefined>;

export interface DepartmentOfficerPayload {
  file_number: string;
  name: string;
  email: string | null;
  department_id: number;
}

/** School Exam Officer's management of Department Exam Officers. */
export const departmentOfficerService = {
  list: (params?: Params): Promise<Paginated<StaffUser>> =>
    api.get("/exam-officer/department-officers", { params }).then((r) => r.data),

  eligible: (params?: Params): Promise<Paginated<StaffUser>> =>
    api.get("/exam-officer/department-officers/eligible", { params }).then((r) => r.data),

  create: (data: DepartmentOfficerPayload): Promise<{ user: StaffUser; temp_password: string }> =>
    api.post("/exam-officer/department-officers", data).then((r) => r.data),

  promote: (userId: number, departmentId: number, reason?: string): Promise<{ data: StaffUser }> =>
    api.post(`/exam-officer/department-officers/${userId}/promote`, { department_id: departmentId, reason }).then((r) => r.data),

  demote: (userId: number, reason?: string): Promise<{ data: StaffUser }> =>
    api.post(`/exam-officer/department-officers/${userId}/demote`, { reason }).then((r) => r.data),

  resetPassword: (userId: number): Promise<{ temp_password: string }> =>
    api.post(`/exam-officer/department-officers/${userId}/reset-password`).then((r) => r.data),

  deactivate: (userId: number): Promise<void> =>
    api.delete(`/exam-officer/department-officers/${userId}`).then(() => undefined),
};
