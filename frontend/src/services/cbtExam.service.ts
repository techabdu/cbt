import { api } from "@/lib/api";
import type { Paginated } from "@/types/common.types";
import type { Exam, ExamCode } from "@/types/exam.types";
import type { QuestionBank } from "@/types/question.types";

export interface CreateExamPayload {
  question_bank_id: number;
  exam_date: string;
  start_time: string;
  duration_minutes: number;
}

export type UpdateExamPayload = Omit<CreateExamPayload, "question_bank_id">;

export interface CbtAdminStats {
  approved_banks: number;
  scheduled_exams: number;
  synced_exams: number;
  total_exams: number;
  codes_generated: number;
  exam_officers: number;
}

export const cbtExamService = {
  stats: (): Promise<CbtAdminStats> =>
    api.get("/cbt-admin/stats").then((r) => r.data),

  // Approved question banks (read-only)
  approvedBanks: (params?: Record<string, string | number | undefined>): Promise<Paginated<QuestionBank>> =>
    api.get("/cbt-admin/question-banks", { params }).then((r) => r.data),

  bank: (id: number): Promise<{ data: QuestionBank }> =>
    api.get(`/cbt-admin/question-banks/${id}`).then((r) => r.data),

  // Exams
  list: (params?: Record<string, string | number | undefined>): Promise<Paginated<Exam>> =>
    api.get("/cbt-admin/exams", { params }).then((r) => r.data),

  get: (id: number): Promise<{ data: Exam }> =>
    api.get(`/cbt-admin/exams/${id}`).then((r) => r.data),

  create: (data: CreateExamPayload): Promise<{ data: Exam }> =>
    api.post("/cbt-admin/exams", data).then((r) => r.data),

  update: (id: number, data: UpdateExamPayload): Promise<{ data: Exam }> =>
    api.put(`/cbt-admin/exams/${id}`, data).then((r) => r.data),

  remove: (id: number): Promise<void> =>
    api.delete(`/cbt-admin/exams/${id}`),

  // Exam codes
  codes: (examId: number, params?: Record<string, string | number | undefined>): Promise<Paginated<ExamCode>> =>
    api.get(`/cbt-admin/exams/${examId}/codes`, { params }).then((r) => r.data),

  generateCodes: (examId: number): Promise<{ created: number; total_codes: number; message: string }> =>
    api.post(`/cbt-admin/exams/${examId}/codes/generate`).then((r) => r.data),

  // Sync
  sync: (examId: number): Promise<{ message: string; exam: { data: Exam } }> =>
    api.post(`/cbt-admin/exams/${examId}/sync`).then((r) => r.data),

  syncLogs: (params?: Record<string, string | number | undefined>): Promise<Paginated<import("@/types/sync.types").SyncLog>> =>
    api.get("/cbt-admin/sync-logs", { params }).then((r) => r.data),
};
