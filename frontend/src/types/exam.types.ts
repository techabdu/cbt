import type { ExamStatus, Semester } from "@/types/common.types";
import type { Course } from "@/types/course.types";
import type { QuestionBank } from "@/types/question.types";

export interface Exam {
  id: number;
  course_id: number;
  course?: Course;
  question_bank_id: number;
  question_bank?: QuestionBank;
  session: string;
  semester: Semester;
  exam_date: string;
  start_time: string;
  duration_minutes: number;
  status: ExamStatus;
  configured_by?: { id: number; name: string } | null;
  codes_count?: number;
  eligible_count?: number;
  created_at?: string;
}

export interface ExamCode {
  id: number;
  exam_id: number;
  student_id: number;
  student?: { id: number; matric_number: string; full_name: string };
  code: string;
  is_used: boolean;
  used_at: string | null;
}

export interface RoleUpgrade {
  id: number;
  user?: { id: number; name: string; file_number: string } | null;
  from_role: string;
  to_role: string;
  reason: string | null;
  upgraded_by?: { id: number; name: string } | null;
  created_at: string;
}
