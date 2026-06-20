import { api } from "@/lib/api";
import type { Paginated } from "@/types/common.types";
import type { Exam } from "@/types/exam.types";
import type { ExamResult } from "@/types/result.types";

export const resultsService = {
  // Lecturer: list exams with results_synced status
  list: (params?: Record<string, string | number | undefined>): Promise<Paginated<Exam>> =>
    api.get("/lecturer/results", { params }).then((r) => r.data),

  // Lecturer: one exam's per-student results
  show: (examId: number, params?: Record<string, string | number | undefined>): Promise<{ exam: Exam; results: ExamResult[] }> =>
    api.get(`/lecturer/results/${examId}`, { params }).then((r) => r.data),

  // Exports — browser handles download via window.location or anchor
  pdfUrl: (examId: number): string => `/api/lecturer/results/${examId}/export/pdf`,
  excelUrl: (examId: number): string => `/api/lecturer/results/${examId}/export/excel`,
};
