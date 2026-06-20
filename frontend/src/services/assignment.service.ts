import { api } from "@/lib/api";
import type { Paginated } from "@/types/common.types";
import type { StaffUser } from "@/types/user.types";
import type { Student } from "@/types/student.types";

export const assignmentService = {
  // Lecturers
  courseLecturers: (courseId: number): Promise<{ data: StaffUser[] }> =>
    api.get(`/exam-officer/courses/${courseId}/lecturers`).then((r) => r.data),

  assignLecturer: (
    courseId: number,
    data: { lecturer_id: number; session: string; semester: string }
  ): Promise<{ message: string }> =>
    api.post(`/exam-officer/courses/${courseId}/assign-lecturer`, data).then((r) => r.data),

  removeLecturer: (courseId: number, lecturerId: number): Promise<void> =>
    api.delete(`/exam-officer/courses/${courseId}/lecturers/${lecturerId}`),

  // Students
  courseStudents: (
    courseId: number,
    params?: Record<string, string | number | undefined>
  ): Promise<Paginated<Student>> =>
    api.get(`/exam-officer/courses/${courseId}/students`, { params }).then((r) => r.data),

  assignStudents: (
    courseId: number,
    data: { student_ids: number[]; session: string; semester: string }
  ): Promise<{ message: string }> =>
    api.post(`/exam-officer/courses/${courseId}/assign-students`, data).then((r) => r.data),

  removeStudent: (courseId: number, studentId: number): Promise<void> =>
    api.delete(`/exam-officer/courses/${courseId}/students/${studentId}`),
};
