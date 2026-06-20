import type { StudentLevel, Semester } from "@/types/common.types";
import type { Department } from "@/types/user.types";
import type { Combination } from "@/types/combination.types";

export interface Student {
  id: number;
  matric_number: string;
  full_name: string;
  department_id: number | null;
  department?: Department | null;
  combination_id: number | null;
  combination?: Combination | null;
  school_id: number;
  level: StudentLevel;
  photo_path: string | null;
  is_active: boolean;
}

export interface StudentCourseEnrolment {
  id: number;
  student_id: number;
  course_id: number;
  session: string;
  semester: Semester;
}
