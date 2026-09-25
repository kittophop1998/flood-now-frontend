import type { ApiErrorBody } from "@/types/report";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (err) {
    // Aborts are the caller cancelling a stale request, not a network failure.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, { code: "NETWORK_ERROR", message: "Couldn't reach the server. Check your connection." });
  }

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
    request<T>(path, { method, signal, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  return {
    get: <T>(path: string, signal?: AbortSignal) => send<T>("GET", path, undefined, signal),
    post: <T>(path: string, body?: unknown, signal?: AbortSignal) => send<T>("POST", path, body, signal),
    put: <T>(path: string, body?: unknown) => send<T>("PUT", path, body),
    patch: <T>(path: string, body?: unknown) => send<T>("PATCH", path, body),
    delete: <T>(path: string) => send<T>("DELETE", path),
  };
}

// Single centralized API client — every service call goes through this.
// Components must not call fetch() directly. See CLAUDE.md.
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
