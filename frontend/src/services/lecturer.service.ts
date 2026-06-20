import { api } from "@/lib/api";
import type { Paginated } from "@/types/common.types";
import type { StaffUser } from "@/types/user.types";
import type { LecturerInput } from "@/lib/validators";

export const lecturerService = {
  list: (params?: Record<string, string | number | undefined>): Promise<Paginated<StaffUser>> =>
    api.get("/exam-officer/lecturers", { params }).then((r) => r.data),

  create: (data: LecturerInput): Promise<{ user: StaffUser; temp_password: string }> =>
    api.post("/exam-officer/lecturers", data).then((r) => r.data),

  update: (id: number, data: Partial<LecturerInput & { is_active: boolean }>): Promise<{ data: StaffUser }> =>
    api.put(`/exam-officer/lecturers/${id}`, data).then((r) => r.data),

  deactivate: (id: number): Promise<void> =>
    api.delete(`/exam-officer/lecturers/${id}`),

  resetPassword: (id: number): Promise<{ temp_password: string }> =>
    api.post(`/exam-officer/lecturers/${id}/reset-password`).then((r) => r.data),
};
