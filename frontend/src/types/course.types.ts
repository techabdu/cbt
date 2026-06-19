import type { StudentLevel, Semester } from "@/types/common.types";
import type { Department } from "@/types/user.types";

export interface Course {
  id: number;
  school_id: number;
  department_id: number;
  department?: Department;
  title: string;
  code: string;
  credit_units: number;
  level: StudentLevel;
  semester: Semester;
}

export interface LecturerCourseAssignment {
  id: number;
  lecturer_id: number;
  course_id: number;
  course?: Course;
  session: string;
  semester: Semester;
}
