import { api } from "@/lib/api";
import type { College } from "@/types/user.types";

export interface UpdateCollegePayload {
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
}

export const collegeService = {
  get(): Promise<College> {
    return api.get<{ data: College }>("/super-admin/college").then((r) => r.data.data);
  },

  update(payload: UpdateCollegePayload): Promise<College> {
    return api.put<{ data: College }>("/super-admin/college", payload).then((r) => r.data.data);
  },
};
