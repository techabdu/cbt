import type { Student } from "@/types/student.types";

export interface ExamResult {
  id: number;
  exam_id: number;
  student_id: number;
  student?: Student;
  total_score: number;
  total_marks: number;
  percentage: number;
  grade: string | null;
  is_absent: boolean;
  synced_at: string | null;
}

export interface ExamSession {
  id: number;
  exam_id: number;
  student_id: number;
  started_at: string | null;
  submitted_at: string | null;
  is_auto_submitted: boolean;
  synced_at: string | null;
}
