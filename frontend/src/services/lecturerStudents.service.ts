import { api } from "@/lib/api";
import type { Paginated } from "@/types/common.types";
import type { Student } from "@/types/student.types";

/** Read-only roster of students in the authenticated lecturer's courses. */
export const lecturerStudentsService = {
  list: (params?: Record<string, string | number | undefined>): Promise<Paginated<Student>> =>
    api.get("/lecturer/students", { params }).then((r) => r.data),
};
