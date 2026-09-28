import type { ApiErrorBody } from "@/types/report";
import { getAuthToken, setAuthSession } from "@/lib/auth-session";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:4000";

export class ApiError extends Error {
  code: string;
  fields?: Record<string, string>;
  status: number;

  constructor(status: number, body: ApiErrorBody["error"]) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.fields = body.fields;
  }
}

// userAuth: send the signed-in user's session token (the default client).
// The admin client carries its own operator token instead.
async function request<T>(path: string, init?: RequestInit, userAuth = false): Promise<T> {
  const token = userAuth ? getAuthToken() : null;
  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
    });
  } catch (err) {
    // Aborts are the caller cancelling a stale request, not a network failure.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, { code: "NETWORK_ERROR", message: "Couldn't reach the server. Check your connection." });
  }

  // The session we sent was rejected (expired / signed out elsewhere): drop
  // it so the app falls back to guest mode and can ask to sign in again.
  if (res.status === 401 && token && token === getAuthToken()) setAuthSession(null);

  if (!res.ok) {
    let body: ApiErrorBody;
    try {
      body = await res.json();
    } catch {
      throw new ApiError(res.status, { code: "INTERNAL_ERROR", message: "Something went wrong." });
    }
    throw new ApiError(res.status, body.error);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function createClient(headers?: Record<string, string>) {
  const send = <T>(method: string, path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method, signal, headers, body: body !== undefined ? JSON.stringify(body) : undefined }, !headers);
  return {
    get: <T>(path: string, signal?: AbortSignal) => send<T>("GET", path, undefined, signal),
    post: <T>(path: string, body?: unknown, signal?: AbortSignal) => send<T>("POST", path, body, signal),
    put: <T>(path: string, body?: unknown) => send<T>("PUT", path, body),
    patch: <T>(path: string, body?: unknown) => send<T>("PATCH", path, body),
    delete: <T>(path: string) => send<T>("DELETE", path),
  };
}

// Single centralized API client — every service call goes through this.
// Components must not call fetch() directly. See CLAUDE.md. Sends the user's
// session token when signed in (public endpoints ignore it or personalize).
export const apiClient = createClient();

// Same client carrying the operator token, for /api/v1/admin/* only.
export function adminClient(token: string) {
  return createClient({ Authorization: `Bearer ${token}` });
}

// True when the request never reached the server (offline, DNS, CORS…),
// as opposed to the server answering with an error.
export function isNetworkError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 0;
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

// Builds a query string, skipping empty values and joining arrays with commas.
export function toQuery(params: Record<string, string | number | string[] | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(","));
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
