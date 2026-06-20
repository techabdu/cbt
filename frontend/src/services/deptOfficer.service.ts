import { api } from "@/lib/api";
import type { Paginated } from "@/types/common.types";
import type { Course } from "@/types/course.types";
import type { Student } from "@/types/student.types";
import type { StaffUser } from "@/types/user.types";
import type { DeptCourseInput, LecturerInput } from "@/lib/validators";

type Params = Record<string, string | number | undefined>;

export interface DeptOfficerStats {
  lecturers: number;
  courses: number;
  students: number;
  pending_moderation: number;
}

export interface CourseWithCounts extends Course {
  lecturers_count: number;
  students_count: number;
}

export interface DeptCoursePayload {
  title: string;
  code: string;
  credit_units: number;
  level: string;
  semester: string;
}

export interface LecturerActivity extends StaffUser {
  courses_count?: number;
  question_banks_count?: number;
  approved_banks_count?: number;
}

/** A Department Exam Officer's own department: courses, lecturers, assignments. */
export const deptOfficerService = {
  stats: (): Promise<DeptOfficerStats> =>
    api.get("/department-officer/stats").then((r) => r.data),

  // Courses
  listCourses: (params?: Params): Promise<Paginated<CourseWithCounts>> =>
    api.get("/department-officer/courses", { params }).then((r) => r.data),

  createCourse: (data: DeptCoursePayload): Promise<{ data: CourseWithCounts }> =>
    api.post("/department-officer/courses", data).then((r) => r.data),

  updateCourse: (id: number, data: DeptCoursePayload): Promise<{ data: CourseWithCounts }> =>
    api.put(`/department-officer/courses/${id}`, data).then((r) => r.data),

  removeCourse: (id: number): Promise<void> =>
    api.delete(`/department-officer/courses/${id}`).then(() => undefined),

  // Lecturers
  listLecturers: (params?: Params): Promise<Paginated<StaffUser>> =>
    api.get("/department-officer/lecturers", { params }).then((r) => r.data),

  createLecturer: (data: LecturerInput): Promise<{ user: StaffUser; temp_password: string }> =>
    api.post("/department-officer/lecturers", data).then((r) => r.data),

  updateLecturer: (id: number, data: Partial<LecturerInput & { is_active: boolean }>): Promise<{ data: StaffUser }> =>
    api.put(`/department-officer/lecturers/${id}`, data).then((r) => r.data),

  deactivateLecturer: (id: number): Promise<void> =>
    api.delete(`/department-officer/lecturers/${id}`).then(() => undefined),

  resetLecturerPassword: (id: number): Promise<{ temp_password: string }> =>
    api.post(`/department-officer/lecturers/${id}/reset-password`).then((r) => r.data),

  // Lecturer ↔ course assignment
  courseLecturers: (courseId: number): Promise<{ data: StaffUser[] }> =>
    api.get(`/department-officer/courses/${courseId}/lecturers`).then((r) => r.data),

  assignLecturer: (courseId: number, data: { lecturer_id: number; session: string; semester: string }): Promise<{ message: string }> =>
    api.post(`/department-officer/courses/${courseId}/assign-lecturer`, data).then((r) => r.data),

  removeLecturer: (courseId: number, lecturerId: number): Promise<void> =>
    api.delete(`/department-officer/courses/${courseId}/lecturers/${lecturerId}`).then(() => undefined),

  courseStudents: (courseId: number, params?: Params): Promise<Paginated<Student>> =>
    api.get(`/department-officer/courses/${courseId}/students`, { params }).then((r) => r.data),

  // Read-only student roster
  listStudents: (params?: Params): Promise<Paginated<Student>> =>
    api.get("/department-officer/students", { params }).then((r) => r.data),

  // Read-only lecturer activity
  lecturerActivity: (params?: Params): Promise<Paginated<LecturerActivity>> =>
    api.get("/department-officer/lecturer-activity", { params }).then((r) => r.data),
};
