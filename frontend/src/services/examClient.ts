import axios from "axios";

import type {
  ExamLoginResponse,
  ExamSubmitResponse,
} from "@/types/studentExam.types";

/**
 * Dedicated axios instance for the offline student exam flow. Unlike the staff
 * client it carries no Sanctum token — students authenticate with a stateless
 * exam token (X-Exam-Token) issued at login and kept in sessionStorage.
 */
const TOKEN_KEY = "cbt_exam_token";

export const examApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api",
  headers: { Accept: "application/json" },
});

examApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) config.headers["X-Exam-Token"] = token;
  }
  return config;
});

export const examToken = {
  get: () => (typeof window !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) : null),
  set: (token: string) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

export const examService = {
  login: (matric_number: string, exam_code: string): Promise<ExamLoginResponse> =>
    examApi.post("/student/exam/login", { matric_number, exam_code }).then((r) => r.data),

  resume: (): Promise<ExamLoginResponse> =>
    examApi.get("/student/exam/resume").then((r) => r.data),

  answer: (question_id: number, answer: string | null, order_index = 0): Promise<void> =>
    examApi.post("/student/exam/answer", { question_id, answer, order_index }).then(() => undefined),

  autosave: (answers: { question_id: number; answer: string | null }[]): Promise<{ at: string }> =>
    examApi.post("/student/exam/autosave", { answers }).then((r) => r.data),

  submit: (auto_submitted = false): Promise<ExamSubmitResponse> =>
    examApi.post("/student/exam/submit", { auto_submitted }).then((r) => r.data),
};
