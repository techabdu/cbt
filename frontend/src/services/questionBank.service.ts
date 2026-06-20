import { api } from "@/lib/api";
import type { Paginated } from "@/types/common.types";
import type {
  QuestionBank,
  Question,
  QuestionPayload,
  LecturerAssignment,
} from "@/types/question.types";

export interface CreateBankPayload {
  course_id: number;
  title?: string | null;
  session: string;
  semester: string;
}

export const questionBankService = {
  // Teaching assignments (course + session + semester)
  myCourses: (): Promise<{ data: LecturerAssignment[] }> =>
    api.get("/lecturer/courses").then((r) => r.data),

  // Banks
  list: (params?: Record<string, string | number | undefined>): Promise<Paginated<QuestionBank>> =>
    api.get("/lecturer/question-banks", { params }).then((r) => r.data),

  get: (id: number): Promise<{ data: QuestionBank }> =>
    api.get(`/lecturer/question-banks/${id}`).then((r) => r.data),

  create: (data: CreateBankPayload): Promise<{ data: QuestionBank }> =>
    api.post("/lecturer/question-banks", data).then((r) => r.data),

  update: (id: number, data: Partial<CreateBankPayload>): Promise<{ data: QuestionBank }> =>
    api.put(`/lecturer/question-banks/${id}`, data).then((r) => r.data),

  remove: (id: number): Promise<void> =>
    api.delete(`/lecturer/question-banks/${id}`),

  submit: (id: number): Promise<{ data: QuestionBank }> =>
    api.post(`/lecturer/question-banks/${id}/submit`).then((r) => r.data),

  // Questions
  addQuestion: (bankId: number, data: QuestionPayload): Promise<{ data: Question }> =>
    api.post(`/lecturer/question-banks/${bankId}/questions`, data).then((r) => r.data),

  updateQuestion: (bankId: number, questionId: number, data: QuestionPayload): Promise<{ data: Question }> =>
    api.put(`/lecturer/question-banks/${bankId}/questions/${questionId}`, data).then((r) => r.data),

  removeQuestion: (bankId: number, questionId: number): Promise<void> =>
    api.delete(`/lecturer/question-banks/${bankId}/questions/${questionId}`),
};
