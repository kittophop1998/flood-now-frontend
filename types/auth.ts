// Mirrors the auth section of docs/api-spec.md.

// The signed-in user's own account (never someone else's).
export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

// Sign-up / sign-in. The session token is only in the HttpOnly cookie.
export interface AuthSessionResponse {
  expires_in: number;
  user: AuthUser;
  csrf_token: string;
}

// GET /auth/session — a guest is { user: null, csrf_token: null }.
export interface AuthSessionState {
  user: AuthUser | null;
  csrf_token: string | null;
}

export interface RegisterInput {
  email: string;
  password: string;
  display_name: string;
  device_id?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  device_id?: string;
}
