// Client-side helpers for community events: the lifecycle re-derived from the
// server's timestamps (same rule as apps/api/internal/domain/event), and the
// "happening now / upcoming" split. Pure, unit-tested (tests/events.test.ts).
import type { CommunityEvent, EventStatus } from "@/types/community";

export function eventStatus(e: Pick<CommunityEvent, "status" | "end_at">, now: Date): EventStatus {
  if (e.status === "cancelled") return "cancelled";
  if (now.getTime() >= new Date(e.end_at).getTime()) return "ended";
  return "active";
}

// Active and already started.
export function isHappeningNow(e: Pick<CommunityEvent, "status" | "start_at" | "end_at">, now: Date): boolean {
  return eventStatus(e, now) === "active" && now.getTime() >= new Date(e.start_at).getTime();
}

// Events to show on the map / in lists: not ended; happening now first, then
// soonest start; cancelled ones last (still shown, labelled, until their end).
export function visibleEvents<T extends CommunityEvent>(events: T[], now: Date): T[] {
  const rank = (e: T) => (eventStatus(e, now) === "cancelled" ? 2 : isHappeningNow(e, now) ? 0 : 1);
  return events
    .filter((e) => eventStatus(e, now) !== "ended")
    .sort((a, b) => rank(a) - rank(b) || new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
}

// Validation mirrored from the API for instant feedback (the server decides).
export function eventWindowError(startAt: Date | null, endAt: Date | null, now: Date): "startRequired" | "endRequired" | "endBeforeStart" | "endInPast" | "tooLong" | null {
  if (!startAt) return "startRequired";
  if (!endAt) return "endRequired";
  if (endAt.getTime() <= startAt.getTime()) return "endBeforeStart";
  if (endAt.getTime() - startAt.getTime() > 31 * 24 * 3600 * 1000) return "tooLong";
  if (endAt.getTime() <= now.getTime()) return "endInPast";
  return null;
}

// <input type="datetime-local"> value (local time) ⇄ Date.
export function toLocalInput(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
