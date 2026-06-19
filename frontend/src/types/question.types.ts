import type {
  QuestionType,
  QuestionBankStatus,
  Semester,
} from "@/types/common.types";
import type { Course } from "@/types/course.types";

export interface QuestionOption {
  id: number;
  question_id: number;
  option_label: string; // A, B, C, D or T / F
  option_text: string;
  is_correct: boolean;
}

export interface QuestionAnswer {
  id: number;
  question_id: number;
  correct_answer: string;
}

export interface Question {
  id: number;
  question_bank_id: number;
  question_text: string;
  question_type: QuestionType;
  marks: number;
  order_index: number;
  options?: QuestionOption[];
  answers?: QuestionAnswer[];
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
  reviewed_by: number | null;
  rejection_reason: string | null;
  questions?: Question[];
}
