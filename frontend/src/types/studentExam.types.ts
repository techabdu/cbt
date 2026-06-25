import type { QuestionType } from "@/types/common.types";

export interface ExamQuestionOption {
  label: string;
  text: string;
}

/** A question as presented to the student — never carries the correct answer. */
export interface ExamQuestion {
  id: number;
  position: number;
  question_text: string;
  question_type: QuestionType;
  marks: number;
  options: ExamQuestionOption[];
}

export interface ExamSessionMeta {
  id: number;
  exam_id: number;
  duration_minutes: number;
  started_at: string;
  ends_at: string;
  server_time: string;
  submitted_at: string | null;
}

export interface StudentInfo {
  matric_number: string;
  full_name: string;
}

export interface ExamLoginResponse {
  token: string;
  session: ExamSessionMeta;
  student: StudentInfo;
  questions: ExamQuestion[];
  saved_answers: Record<number, string | null>;
}

export interface ExamSubmitResponse {
  submitted_at: string;
  auto: boolean;
  message: string;
  answered: number;
  total: number;
  // Grading runs asynchronously on the server; no score/result id is returned
  // at submit time (results are released later).
  status: "grading";
}
