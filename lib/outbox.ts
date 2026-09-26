// Offline queue for the two actions that are safe to replay later: creating
// a normal report (a photo only if it was already uploaded before the
// connection dropped — uploads themselves need the network) and a
// "still happening / it's over" vote (with any condition update whose photo
// was already uploaded). Each item carries a client id the API
// treats as an idempotency key (reports: client_id; votes: one per device
// per report), so retrying never duplicates a submission.
//
// SOS requests are deliberately NOT queued: a queued SOS would look sent
// while nobody can see it. See features/sos.
import type { ConditionUpdate, ConfirmationStatus, CreateReportInput } from "@/types/report";

const STORAGE_KEY = "floodnow:outbox";
export const MAX_OUTBOX_ITEMS = 20;

export type OutboxItem =
  | {
      id: string; // = client_id sent to the API
      kind: "report";
      payload: CreateReportInput;
      createdAt: string;
      attempts: number;
      status: "pending" | "failed";
      error?: string;
    }
  | {
      id: string;
      kind: "confirm";
      reportId: string;
      payload: ConditionUpdate & { status: ConfirmationStatus };
      createdAt: string;
      attempts: number;
      status: "pending" | "failed";
      error?: string;
    };

export function readOutbox(): OutboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as OutboxItem[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeOutbox(items: OutboxItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_OUTBOX_ITEMS)));
  } catch {
    // best-effort
  }
}

// A newer vote on the same report replaces the queued one (the API keeps
// only the latest vote per device anyway).
export function enqueue(items: OutboxItem[], item: OutboxItem): OutboxItem[] {
  const rest =
    item.kind === "confirm" ? items.filter((i) => !(i.kind === "confirm" && i.reportId === item.reportId)) : items;
  return [...rest, item].slice(-MAX_OUTBOX_ITEMS);
}

// What a sync attempt's outcome does to an item: success removes it, a
// network failure leaves it pending for the next try, a rejection by the
// server (validation, not found…) marks it failed for the user to review.
export function applySyncResult(
  items: OutboxItem[],
  id: string,
  result: { ok: true } | { ok: false; retryable: boolean; error: string },
): OutboxItem[] {
  if (result.ok) return items.filter((i) => i.id !== id);
  return items.map((i) =>
    i.id === id
      ? { ...i, attempts: i.attempts + 1, status: result.retryable ? "pending" : "failed", error: result.error }
      : i,
  );
}

export function newClientId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
