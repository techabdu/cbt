import type { ExamStatus, Semester } from "@/types/common.types";
import type { Course } from "@/types/course.types";

export interface Exam {
  id: number;
  course_id: number;
  course?: Course;
  question_bank_id: number;
  session: string;
  semester: Semester;
  exam_date: string;
  start_time: string;
  duration_minutes: number;
  status: ExamStatus;
  configured_by: number | null;
}

export interface ExamCode {
  id: number;
  exam_id: number;
  student_id: number;
  code: string;
  is_used: boolean;
  used_at: string | null;
  generated_at: string | null;
}
