import { api } from "@/lib/api";
import type { Semester } from "@/types/common.types";
import type { AcademicSession } from "@/types/combination.types";

export interface AcademicCalendar {
  data: AcademicSession[];
  current_session: string | null;
  current_semester: Semester | null;
}

export const academicCalendarService = {
  get: (): Promise<AcademicCalendar> =>
    api.get("/exam-officer/academic-calendar").then((r) => r.data),

  createSession: (session: string): Promise<{ data: AcademicSession }> =>
    api.post("/exam-officer/academic-calendar/sessions", { session }).then((r) => r.data),

  setCurrentSession: (id: number): Promise<{ data: AcademicSession }> =>
    api.post(`/exam-officer/academic-calendar/sessions/${id}/set-current`).then((r) => r.data),

  deleteSession: (id: number): Promise<void> =>
    api.delete(`/exam-officer/academic-calendar/sessions/${id}`).then(() => undefined),

  setSemester: (semester: Semester): Promise<{ current_semester: Semester }> =>
    api.put("/exam-officer/academic-calendar/semester", { semester }).then((r) => r.data),
};
