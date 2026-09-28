import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { adminClient, apiClient, ApiError, refreshAuthSession } from "@/services/api-client";
import { getAuthSession, getCsrfToken, setAuthSession } from "@/lib/auth-session";
import type { AuthUser } from "@/types/auth";

// The cookie-session contract of the one API client: the session cookie
// rides along (credentials), the CSRF token only on writes, nothing about
// the session is stored in the browser, and a stale CSRF token recovers.

const user: AuthUser = { id: "u1", email: "a@example.com", display_name: "A", created_at: "2026-09-29T00:00:00Z" };

interface Call {
  url: string;
  init: RequestInit;
}
let calls: Call[];
let replies: Array<() => Response>;
const realFetch = globalThis.fetch;

function json(status: number, body: unknown) {
  return () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function header(call: Call, name: string): string | undefined {
  return (call.init.headers as Record<string, string>)[name];
}

beforeEach(() => {
  calls = [];
  replies = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = replies.shift();
    if (!next) throw new Error(`unexpected request ${url}`);
    return next();
  }) as typeof fetch;
  setAuthSession(null);
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("reads send the cookie but no CSRF token; writes send both", async () => {
  setAuthSession({ user, csrfToken: "csrf-1" });
  replies.push(json(200, { events: [] }), json(201, { id: "e1" }));
  await apiClient.get("/api/v1/events");
  await apiClient.post("/api/v1/events", { title: "x" });

  assert.equal(calls[0].init.credentials, "include");
  assert.equal(header(calls[0], "X-CSRF-Token"), undefined);
  assert.equal(calls[1].init.credentials, "include");
  assert.equal(header(calls[1], "X-CSRF-Token"), "csrf-1");
  assert.equal(header(calls[1], "Authorization"), undefined, "no bearer token any more");
});

test("the admin client sends its operator token and no cookies", async () => {
  replies.push(json(200, { items: [] }));
  await adminClient("operator-token").get("/api/v1/admin/announcements");
  assert.equal(calls[0].init.credentials, "omit");
  assert.equal(header(calls[0], "Authorization"), "Bearer operator-token");
});

test("session state comes from GET /auth/session and nothing is persisted", async () => {
  const stored: string[] = [];
  const storage = { setItem: (k: string) => stored.push(k), getItem: () => null, removeItem: () => {} };
  Object.assign(globalThis, { localStorage: storage, sessionStorage: storage });

  replies.push(json(200, { user, csrf_token: "csrf-2" }));
  await refreshAuthSession();
  assert.equal(calls[0].url.endsWith("/api/v1/auth/session"), true);
  assert.deepEqual(getAuthSession(), { user, csrfToken: "csrf-2" });
  assert.deepEqual(stored, [], "no session data in web storage");

  replies.push(json(200, { user: null, csrf_token: null }));
  await refreshAuthSession();
  assert.equal(getAuthSession(), null);
});

test("a stale CSRF token is refreshed once and the write retried", async () => {
  setAuthSession({ user, csrfToken: "old" });
  replies.push(
    json(403, { error: { code: "CSRF_TOKEN_INVALID", message: "invalid CSRF token" } }),
    json(200, { user, csrf_token: "new" }),
    json(200, { ok: true }),
  );
  await apiClient.post("/api/v1/reports/r1/reactions", { type: "like" });
  assert.equal(calls.length, 3);
  assert.equal(header(calls[0], "X-CSRF-Token"), "old");
  assert.equal(header(calls[2], "X-CSRF-Token"), "new");
  assert.equal(getCsrfToken(), "new");
});

test("a CSRF rejection is not retried forever, and a signed-out session isn't retried", async () => {
  setAuthSession({ user, csrfToken: "old" });
  replies.push(
    json(403, { error: { code: "CSRF_TOKEN_INVALID", message: "x" } }),
    json(200, { user, csrf_token: "still-bad" }),
    json(403, { error: { code: "CSRF_TOKEN_INVALID", message: "x" } }),
  );
  await assert.rejects(apiClient.post("/api/v1/events", {}), (e: unknown) => e instanceof ApiError && e.code === "CSRF_TOKEN_INVALID");
  assert.equal(calls.length, 3);

  setAuthSession({ user, csrfToken: "old" });
  calls = [];
  replies.push(json(403, { error: { code: "CSRF_TOKEN_MISSING", message: "x" } }), json(200, { user: null, csrf_token: null }));
  await assert.rejects(apiClient.post("/api/v1/events", {}));
  assert.equal(calls.length, 2, "no retry once the session is gone");
  assert.equal(getAuthSession(), null);
});

test("a 401 for the session we sent drops back to guest", async () => {
  setAuthSession({ user, csrfToken: "c" });
  replies.push(json(401, { error: { code: "UNAUTHORIZED", message: "sign in" } }));
  await assert.rejects(apiClient.get("/api/v1/saved-places"));
  assert.equal(getAuthSession(), null);
});
