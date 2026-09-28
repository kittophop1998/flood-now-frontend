import { apiClient } from "@/services/api-client";
import type { AuthSessionResponse, AuthUser, LoginInput, RegisterInput } from "@/types/auth";

export const authService = {
  register: (input: RegisterInput) => apiClient.post<AuthSessionResponse>("/api/v1/auth/register", input),
  login: (input: LoginInput) => apiClient.post<AuthSessionResponse>("/api/v1/auth/login", input),
  logout: () => apiClient.post<void>("/api/v1/auth/logout"),
  me: (signal?: AbortSignal) => apiClient.get<{ user: AuthUser }>("/api/v1/auth/me", signal).then((r) => r.user),
};
