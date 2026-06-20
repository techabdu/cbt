import type {
  QuestionType,
  QuestionBankStatus,
  Semester,
} from "@/types/common.types";
import type { Course } from "@/types/course.types";

export interface QuestionOption {
  id: number;
  option_label: string; // A, B, C, D or T / F
  option_text: string;
  is_correct: boolean;
}

export interface Question {
  id: number;
  question_bank_id: number;
  question_text: string;
  question_type: QuestionType;
  marks: number;
  order_index: number;
  options?: QuestionOption[];
  /** Fill-in-the-blank accepted answers, returned as plain strings. */
  answers?: string[];
}

export interface QuestionBank {
  id: number;
  lecturer_id: number;
  course_id: number;
  course?: Course;
  title: string | null;
  session: string;
  semester: Semester;
  total_questions: number;
  status: QuestionBankStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewer?: { id: number; name: string } | null;
  rejection_reason: string | null;
  questions?: Question[];
  is_editable: boolean;
  created_at?: string;
  updated_at?: string;
}

/** One teaching assignment surfaced by GET /lecturer/courses. */
export interface LecturerAssignment {
  course: Course;
  session: string;
  semester: Semester;
}

/** Payload to create/replace a question (mirrors the backend FormRequest). */
export interface QuestionPayload {
  question_text: string;
  question_type: QuestionType;
  marks: number;
  options?: { option_text: string; is_correct: boolean }[];
  correct_answer?: "true" | "false";
  answers?: string[];
}
