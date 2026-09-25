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
  } catch {
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

// Single centralized API client — every service call goes through this.
// Components must not call fetch() directly. See CLAUDE.md.
export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
};
