import { api } from "@/lib/api";
import type { LoginCredentials, LoginResponse, ChangePasswordPayload } from "@/types/auth.types";
import type { AuthUser } from "@/types/auth.types";

export const authService = {
  login(credentials: LoginCredentials): Promise<LoginResponse> {
    return api.post<LoginResponse>("/auth/login", credentials).then((r) => r.data);
  },

  logout(): Promise<void> {
    return api.post("/auth/logout").then(() => undefined);
  },

  me(): Promise<AuthUser> {
    return api.get<{ user: AuthUser }>("/auth/me").then((r) => r.data.user);
  },

  changePassword(payload: ChangePasswordPayload): Promise<void> {
    return api.put("/auth/change-password", payload).then(() => undefined);
  },
};
