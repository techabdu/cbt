import { api } from "@/lib/api";
import type { Paginated } from "@/types/common.types";
import type { Combination } from "@/types/combination.types";
import type { Student } from "@/types/student.types";

type Params = Record<string, string | number | undefined>;

export interface CombinationPayload {
  name: string;
  code: string;
  department_ids: number[];
}

export const combinationService = {
  list: (params?: Params): Promise<Paginated<Combination>> =>
    api.get("/exam-officer/combinations", { params }).then((r) => r.data),

  create: (data: CombinationPayload): Promise<{ data: Combination }> =>
    api.post("/exam-officer/combinations", data).then((r) => r.data),

  update: (id: number, data: CombinationPayload): Promise<{ data: Combination }> =>
    api.put(`/exam-officer/combinations/${id}`, data).then((r) => r.data),

  remove: (id: number): Promise<void> =>
    api.delete(`/exam-officer/combinations/${id}`).then(() => undefined),

  students: (id: number, params?: Params): Promise<Paginated<Student>> =>
    api.get(`/exam-officer/combinations/${id}/students`, { params }).then((r) => r.data),

  assignStudents: (id: number, studentIds: number[]): Promise<{ message: string; enrolments_created: number }> =>
    api.post(`/exam-officer/combinations/${id}/assign-students`, { student_ids: studentIds }).then((r) => r.data),

  removeStudent: (id: number, studentId: number): Promise<void> =>
    api.delete(`/exam-officer/combinations/${id}/students/${studentId}`).then(() => undefined),
};
