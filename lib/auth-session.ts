// Who is signed in, in memory only. The session itself is an HttpOnly cookie
// the API sets — page scripts can never read it, and nothing about it is
// kept in localStorage/sessionStorage. The state is loaded from
// GET /auth/session on start (features/auth) and after sign-in; the CSRF
// token it carries is echoed by services/api-client.ts on signed-in writes.
// FloodNow is guest-first: no session simply means "guest". A tiny external
// store so the api client and React stay in sync without prop drilling.
import type { AuthUser } from "@/types/auth";

export interface AuthSession {
  user: AuthUser;
  csrfToken: string;
}

// Older builds kept a bearer token here; it's useless now, so drop it.
const LEGACY_STORAGE_KEY = "floodnow:auth";
// Tells other tabs to re-read the session after sign-in/out here.
const CHANNEL = "floodnow:auth";

let current: AuthSession | null = null;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    channel = typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL) : null;
  }
  return channel;
}

export function getAuthSession(): AuthSession | null {
  return current;
}

export function getCsrfToken(): string | null {
  return current?.csrfToken ?? null;
}

// broadcast: this tab signed in/out (not just learned the state), so other
// tabs should re-read theirs from the server.
export function setAuthSession(session: AuthSession | null, broadcast = false) {
  current = session;
  listeners.forEach((l) => l());
  if (broadcast) getChannel()?.postMessage("changed");
}

export function subscribeAuthSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Runs onChange when another tab signs in or out.
export function onAuthChangedElsewhere(onChange: () => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  ch.addEventListener("message", onChange);
  return () => ch.removeEventListener("message", onChange);
}

export function forgetLegacyStoredSession() {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage blocked: nothing was stored either.
  }
}
