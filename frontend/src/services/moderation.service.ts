import { api } from "@/lib/api";
import type { Paginated } from "@/types/common.types";
import type { QuestionBank } from "@/types/question.types";

export const moderationService = {
  list: (params?: Record<string, string | number | undefined>): Promise<Paginated<QuestionBank>> =>
    api.get("/exam-officer/moderation", { params }).then((r) => r.data),

  get: (id: number): Promise<{ data: QuestionBank }> =>
    api.get(`/exam-officer/moderation/${id}`).then((r) => r.data),

  approve: (id: number): Promise<{ data: QuestionBank }> =>
    api.post(`/exam-officer/moderation/${id}/approve`).then((r) => r.data),

  reject: (id: number, reason: string): Promise<{ data: QuestionBank }> =>
    api.post(`/exam-officer/moderation/${id}/reject`, { reason }).then((r) => r.data),
};
