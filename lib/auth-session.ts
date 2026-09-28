// The signed-in session (bearer token + the user's own account), kept in
// localStorage so it survives reloads and the installed PWA. FloodNow is
// guest-first: no session simply means "guest". Read by services/api-client.ts
// (to send the token) and features/auth (to render). A tiny external store so
// both stay in sync without prop drilling.
import type { AuthUser } from "@/types/auth";

const STORAGE_KEY = "floodnow:auth";

export interface AuthSession {
  token: string;
  user: AuthUser;
}

let current: AuthSession | null | undefined; // undefined = not read yet
const listeners = new Set<() => void>();

function read(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as AuthSession) : null;
    return parsed?.token && parsed.user?.id ? parsed : null;
  } catch {
    return null;
  }
}

export function getAuthSession(): AuthSession | null {
  if (current === undefined) current = read();
  return current;
}

export function getAuthToken(): string | null {
  return getAuthSession()?.token ?? null;
}

export function setAuthSession(session: AuthSession | null) {
  current = session;
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the session still lives for this page load.
  }
  listeners.forEach((l) => l());
}

export function subscribeAuthSession(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab signing in/out.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    current = read();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
