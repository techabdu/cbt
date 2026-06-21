import { api } from "@/lib/api";
import type { Paginated } from "@/types/common.types";
import type { Course } from "@/types/course.types";
import type { StaffUser } from "@/types/user.types";

type Params = Record<string, string | number | undefined>;

export interface ExamOfficerStats {
  lecturers: number;
  department_officers: number;
  students: number;
  courses: number;
  departments: number;
  combinations: number;
  pending_moderation: number;
}

export interface OversightCourse extends Course {
  lecturers_count: number;
  students_count: number;
}

export const examOfficerService = {
  stats: (): Promise<ExamOfficerStats> =>
    api.get("/exam-officer/stats").then((r) => r.data),

  // Read-only oversight across all departments
  oversightCourses: (params?: Params): Promise<Paginated<OversightCourse>> =>
    api.get("/exam-officer/oversight/courses", { params }).then((r) => r.data),

  oversightLecturers: (params?: Params): Promise<Paginated<StaffUser>> =>
    api.get("/exam-officer/oversight/lecturers", { params }).then((r) => r.data),
};
