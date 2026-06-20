import { api } from "@/lib/api";

export interface ExamOfficerStats {
  lecturers: number;
  students: number;
  courses: number;
  departments: number;
  pending_moderation: number;
}

export const examOfficerService = {
  stats: (): Promise<ExamOfficerStats> =>
    api.get("/exam-officer/stats").then((r) => r.data),
};
