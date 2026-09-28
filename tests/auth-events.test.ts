import { test } from "node:test";
import assert from "node:assert/strict";
import { canReport, isGuestReportable } from "@/lib/auth-gate";
import { eventStatus, eventWindowError, isHappeningNow, visibleEvents } from "@/lib/events";
import { CREATABLE_REPORT_TYPES, REPORT_TYPES } from "@/types/report";
import type { CommunityEvent } from "@/types/community";

// Mirrors guestReportable in apps/api/internal/domain/report/report.go
// (TestGuestReportableCategories) — the server enforces it; the form only
// decides which tiles ask a guest to sign in first.
const API_GUEST_REPORTABLE = ["flooded", "road_closed", "accident", "obstruction", "road_damage", "traffic_signal_issue", "power_outage"];

test("guest-reportable categories mirror the API rule", () => {
  const guest = REPORT_TYPES.filter((t) => isGuestReportable(t));
  assert.deepEqual([...guest].sort(), [...API_GUEST_REPORTABLE].sort());
  for (const t of guest) assert.ok((CREATABLE_REPORT_TYPES as readonly string[]).includes(t), `${t} must be creatable`);
});

test("a guest can pick only safety-critical categories; a signed-in user any creatable one", () => {
  assert.equal(canReport("flooded", false), true);
  assert.equal(canReport("accident", false), true);
  assert.equal(canReport("construction", false), false);
  assert.equal(canReport("shelter", false), false);
  assert.equal(canReport("aid_point", false), false);
  for (const t of CREATABLE_REPORT_TYPES) assert.equal(canReport(t, true), true);
});

function ev(partial: Partial<CommunityEvent>): CommunityEvent {
  return {
    id: "e1",
    title: "งานวัด",
    description: null,
    category: "temple_fair",
    latitude: 13.75,
    longitude: 100.5,
    location_name: null,
    start_at: "2026-09-28T10:00:00Z",
    end_at: "2026-09-28T22:00:00Z",
    image_key: null,
    image_url: null,
    status: "active",
    organizer: { display_name: "สมชาย" },
    is_mine: false,
    cancelled_at: null,
    created_at: "2026-09-27T00:00:00Z",
    updated_at: "2026-09-27T00:00:00Z",
    ...partial,
  };
}

test("event status is re-derived from end_at; an ended event is never active", () => {
  const e = ev({});
  assert.equal(eventStatus(e, new Date("2026-09-28T09:00:00Z")), "active");
  assert.equal(isHappeningNow(e, new Date("2026-09-28T09:00:00Z")), false);
  assert.equal(isHappeningNow(e, new Date("2026-09-28T12:00:00Z")), true);
  // The API said active at fetch time, but end_at has passed since.
  assert.equal(eventStatus(e, new Date("2026-09-28T22:00:00Z")), "ended");
  assert.equal(eventStatus(ev({ status: "cancelled" }), new Date("2026-09-28T12:00:00Z")), "cancelled");
});

test("visible events: ended dropped, happening now first, cancelled last", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  const list = visibleEvents(
    [
      ev({ id: "later", start_at: "2026-09-29T10:00:00Z", end_at: "2026-09-29T20:00:00Z" }),
      ev({ id: "cancelled", status: "cancelled" }),
      ev({ id: "ended", start_at: "2026-09-27T10:00:00Z", end_at: "2026-09-27T20:00:00Z" }),
      ev({ id: "now" }),
    ],
    now,
  );
  assert.deepEqual(
    list.map((e) => e.id),
    ["now", "later", "cancelled"],
  );
});

test("event window validation mirrors the API", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  const at = (iso: string) => new Date(iso);
  assert.equal(eventWindowError(null, at("2026-09-29T00:00:00Z"), now), "startRequired");
  assert.equal(eventWindowError(at("2026-09-29T00:00:00Z"), null, now), "endRequired");
  assert.equal(eventWindowError(at("2026-09-29T10:00:00Z"), at("2026-09-29T09:00:00Z"), now), "endBeforeStart");
  assert.equal(eventWindowError(at("2026-09-27T10:00:00Z"), at("2026-09-28T11:00:00Z"), now), "endInPast");
  assert.equal(eventWindowError(at("2026-09-29T00:00:00Z"), at("2026-11-29T00:00:00Z"), now), "tooLong");
  assert.equal(eventWindowError(at("2026-09-29T10:00:00Z"), at("2026-09-29T22:00:00Z"), now), null);
});
