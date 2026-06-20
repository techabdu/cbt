import { api } from "@/lib/api";
import type { Paginated } from "@/types/common.types";
import type { Course } from "@/types/course.types";

export interface CourseWithCounts extends Course {
  lecturers_count: number;
  students_count: number;
}

export interface CoursePayload {
  department_id: number;
  title: string;
  code: string;
  credit_units: number;
  level: string;
  semester: string;
}

export const courseService = {
  list: (params?: Record<string, string | number | undefined>): Promise<Paginated<CourseWithCounts>> =>
    api.get("/exam-officer/courses", { params }).then((r) => r.data),

  create: (data: CoursePayload): Promise<{ data: CourseWithCounts }> =>
    api.post("/exam-officer/courses", data).then((r) => r.data),

  update: (id: number, data: CoursePayload): Promise<{ data: CourseWithCounts }> =>
    api.put(`/exam-officer/courses/${id}`, data).then((r) => r.data),

  remove: (id: number): Promise<void> =>
    api.delete(`/exam-officer/courses/${id}`),
};
