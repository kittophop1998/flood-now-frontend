import { test } from "node:test";
import assert from "node:assert/strict";
import {
  draftFromAnnouncement,
  draftToInput,
  emptyDraft,
  publishChange,
  toLocalInput,
  validateDraft,
  type AnnouncementDraft,
} from "@/lib/announcement-form";
import { ANNOUNCEMENT_SEVERITY_META, ANNOUNCEMENT_TYPE_META } from "@/lib/community-meta";
import { en } from "@/lib/i18n/en";
import { th } from "@/lib/i18n/th";
import { ANNOUNCEMENT_SEVERITIES, ANNOUNCEMENT_TYPES, type Announcement } from "@/types/community";

const now = new Date("2026-09-27T03:00:00Z");
const hoursFromNow = (h: number) => toLocalInput(new Date(now.getTime() + h * 3_600_000).toISOString());

function filled(over: Partial<AnnouncementDraft> = {}): AnnouncementDraft {
  return {
    ...emptyDraft(now),
    title: "ปิดการจราจรชั่วคราว ถนนพระราม 4",
    body: "ปิดช่องทางซ้าย",
    type: "traffic_notice",
    severity: "info",
    source_name: "กรุงเทพมหานคร",
    ...over,
  };
}

const legacy: Announcement = {
  id: "a1",
  title: "ระบายน้ำเขื่อน",
  body: "เพิ่มการระบายน้ำ",
  type: "water_release",
  severity: "moderate",
  source_name: "กรมชลประทาน",
  source_url: null,
  latitude: 13.7,
  longitude: 100.5,
  radius_m: 3000,
  starts_at: "2026-09-26T00:00:00Z",
  ends_at: "2026-09-30T00:00:00Z",
  status: "active",
  published_at: "2026-09-26T00:00:00Z",
  created_at: "2026-09-26T00:00:00Z",
  updated_at: "2026-09-26T00:00:00Z",
  // no `images`: an API response from before images existed
};

test("every announcement type and severity has an icon and TH/EN labels", () => {
  for (const type of ANNOUNCEMENT_TYPES) {
    assert.ok(ANNOUNCEMENT_TYPE_META[type], type);
    assert.ok(en[`annType.${type}`] && th[`annType.${type}`], type);
  }
  for (const s of ANNOUNCEMENT_SEVERITIES) {
    assert.ok(ANNOUNCEMENT_SEVERITY_META[s], s);
    assert.ok(en[`annSeverity.${s}`] && th[`annSeverity.${s}`], s);
  }
  // Legacy types stay selectable/readable.
  for (const legacyType of ["flood_warning", "water_release", "shelter_info", "safety_notice", "construction"]) {
    assert.ok((ANNOUNCEMENT_TYPES as readonly string[]).includes(legacyType));
  }
});

test("validateDraft requires title, body, source and a start", () => {
  const errors = validateDraft({ ...emptyDraft(now), starts_at: "" }, now);
  assert.deepEqual(Object.keys(errors).sort(), ["body", "source_name", "starts_at", "title"]);
  assert.deepEqual(validateDraft(filled(), now), {});
});

test("validateDraft checks the source URL only when given", () => {
  assert.equal(validateDraft(filled({ source_url: "" }), now).source_url, undefined);
  assert.equal(validateDraft(filled({ source_url: "https://www.doh.go.th/news" }), now).source_url, undefined);
  assert.equal(validateDraft(filled({ source_url: "javascript:alert(1)" }), now).source_url, "annErrSourceUrl");
  assert.equal(validateDraft(filled({ source_url: "www.doh.go.th" }), now).source_url, "annErrSourceUrl");
});

test("validateDraft checks the area and radius", () => {
  assert.equal(validateDraft(filled({ latitude: "13.7", longitude: "" }), now).latitude, "annErrCoords");
  assert.equal(validateDraft(filled({ latitude: "95", longitude: "100" }), now).latitude, "annErrCoords");
  assert.equal(validateDraft(filled({ latitude: "13.7", longitude: "100.5", radius_m: "50" }), now).radius_m, "annErrRadius");
  assert.equal(validateDraft(filled({ latitude: "13.7", longitude: "100.5", radius_m: "0" }), now).radius_m, "annErrRadius");
  assert.deepEqual(validateDraft(filled({ latitude: "13.7", longitude: "100.5", radius_m: "" }), now), {});
});

test("validateDraft checks the window and the schedule", () => {
  assert.equal(validateDraft(filled({ starts_at: hoursFromNow(0), ends_at: hoursFromNow(-1) }), now).ends_at, "annErrEnd");
  assert.deepEqual(validateDraft(filled({ ends_at: "" }), now), {}, "no end is valid");
  assert.equal(validateDraft(filled({ mode: "schedule", starts_at: hoursFromNow(-1) }), now).starts_at, "annErrSchedule");
  assert.deepEqual(validateDraft(filled({ mode: "schedule", starts_at: hoursFromNow(2) }), now), {});
});

test("draftToInput builds a create payload", () => {
  const input = draftToInput(
    filled({ latitude: "13.72", longitude: "100.55", radius_m: "500", mode: "now", starts_at: hoursFromNow(3) }),
    [{ image_key: "announcements/a.jpg", width: 1600, height: 900 }, { image_key: "announcements/b.jpg" }],
    now,
  );
  assert.equal(input.publish, true);
  assert.equal(input.starts_at, now.toISOString(), "publish now never waits for a future start");
  assert.deepEqual(input.images, [{ image_key: "announcements/a.jpg", width: 1600, height: 900 }, { image_key: "announcements/b.jpg" }]);
  assert.equal(input.latitude, 13.72);
  assert.equal(input.radius_m, 500);
  assert.equal(input.source_url, undefined);
  assert.equal(input.clear_location, undefined);

  const draft = draftToInput(filled(), [], now);
  assert.equal(draft.publish, false);
  assert.deepEqual(draft.images, []);
  assert.equal(draft.latitude, undefined);
});

test("an old announcement loads into the form and edits cleanly", () => {
  const d = draftFromAnnouncement(legacy, now);
  assert.equal(d.type, "water_release");
  assert.equal(d.mode, "now");
  assert.equal(d.radius_m, "3000");
  assert.deepEqual(validateDraft(d, now), {});

  const unchanged = draftToInput(d, [], now, legacy);
  assert.equal(unchanged.publish, undefined, "publish state changes go through /publish");
  assert.equal(unchanged.clear_location, undefined);
  assert.equal(unchanged.clear_ends_at, undefined);
  assert.equal(unchanged.starts_at, new Date(legacy.starts_at).toISOString(), "an active record keeps its start");
  assert.equal(unchanged.source_url, "");
  assert.equal(publishChange(d, legacy), null);

  const cleared = draftToInput({ ...d, latitude: "", longitude: "", radius_m: "", ends_at: "" }, [], now, legacy);
  assert.equal(cleared.clear_location, true);
  assert.equal(cleared.clear_ends_at, true);
  assert.equal(cleared.latitude, undefined);

  const pointOnly = draftToInput({ ...d, radius_m: "" }, [], now, legacy);
  assert.equal(pointOnly.clear_location, true, "dropping only the radius re-sends the point");
  assert.equal(pointOnly.latitude, 13.7);

  assert.equal(publishChange({ ...d, mode: "draft" }, legacy), false);
  assert.equal(publishChange({ ...d, mode: "now" }, { published_at: null }), true);
});
