import { apiClient, refreshAuthSession } from "@/services/api-client";
import type { AuthSessionResponse, LoginInput, RegisterInput } from "@/types/auth";

export const authService = {
  register: (input: RegisterInput) => apiClient.post<AuthSessionResponse>("/api/v1/auth/register", input),
  login: (input: LoginInput) => apiClient.post<AuthSessionResponse>("/api/v1/auth/login", input),
  logout: () => apiClient.post<void>("/api/v1/auth/logout"),
  // Loads who is signed in from the session cookie into lib/auth-session.
  refresh: (signal?: AbortSignal) => refreshAuthSession(signal),
};
