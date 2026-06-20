import { api } from "@/lib/api";
import type { Paginated } from "@/types/common.types";
import type { Student } from "@/types/student.types";

export interface StudentPayload {
  matric_number: string;
  full_name: string;
  department_id: number;
  level: string;
  is_active?: boolean;
}

export const studentService = {
  list: (params?: Record<string, string | number | undefined>): Promise<Paginated<Student>> =>
    api.get("/exam-officer/students", { params }).then((r) => r.data),

  create: (data: StudentPayload): Promise<{ data: Student }> =>
    api.post("/exam-officer/students", data).then((r) => r.data),

  update: (id: number, data: Partial<StudentPayload>): Promise<{ data: Student }> =>
    api.put(`/exam-officer/students/${id}`, data).then((r) => r.data),

  remove: (id: number): Promise<void> =>
    api.delete(`/exam-officer/students/${id}`),
};
