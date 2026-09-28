// Mirrors the auth section of docs/api-spec.md.

// The signed-in user's own account (never someone else's).
export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface AuthSessionResponse {
  token: string;
  expires_in: number;
  user: AuthUser;
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
