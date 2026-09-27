// Admin create/edit form for official announcements: the editable draft, its
// validation (mirrors apps/api/internal/domain/announcement, which stays the
// authority) and the mapping to the documented create/PATCH payloads. Pure,
// so it's unit-tested in tests/announcement-form.test.ts.
import type { TranslationKey } from "@/lib/i18n/en";
import type { Announcement, AnnouncementInput, AnnouncementSeverity, AnnouncementType } from "@/types/community";

export const ANNOUNCEMENT_TITLE_MAX = 200;
export const ANNOUNCEMENT_BODY_MAX = 5000;
export const ANNOUNCEMENT_SOURCE_MAX = 200;
export const ANNOUNCEMENT_SOURCE_URL_MAX = 500;
export const ANNOUNCEMENT_RADIUS_MIN_M = 100;
export const ANNOUNCEMENT_RADIUS_MAX_M = 200_000;

// draft = not public; now = public from now on; schedule = public from a
// future starts_at. The API has no separate schedule flag: a published
// announcement whose start is in the future is "scheduled".
export type PublishMode = "draft" | "now" | "schedule";

export interface AnnouncementDraft {
  title: string;
  body: string;
  type: AnnouncementType;
  severity: AnnouncementSeverity;
  source_name: string;
  source_url: string;
  // Text fields so the manual-coordinates inputs can hold partial input.
  latitude: string;
  longitude: string;
  // "" = a point without a radius.
  radius_m: string;
  // datetime-local values (local time).
  starts_at: string;
  ends_at: string;
  mode: PublishMode;
}

export type DraftField = "title" | "body" | "source_name" | "source_url" | "latitude" | "radius_m" | "starts_at" | "ends_at";
export type DraftErrors = Partial<Record<DraftField, TranslationKey>>;

export interface DraftImage {
  image_key: string;
  width?: number | null;
  height?: number | null;
}

export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseLocal(v: string): Date | null {
  if (!v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function numberOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function emptyDraft(now: Date): AnnouncementDraft {
  return {
    title: "",
    body: "",
    type: "general",
    severity: "info",
    source_name: "",
    source_url: "",
    latitude: "",
    longitude: "",
    radius_m: "",
    starts_at: toLocalInput(now.toISOString()),
    ends_at: "",
    mode: "draft",
  };
}

// An existing record as a draft. Legacy records (older type, no images,
// no area) load as-is.
export function draftFromAnnouncement(a: Announcement, now: Date): AnnouncementDraft {
  const mode: PublishMode = a.published_at == null ? "draft" : new Date(a.starts_at) > now ? "schedule" : "now";
  return {
    title: a.title,
    body: a.body,
    type: a.type,
    severity: a.severity,
    source_name: a.source_name,
    source_url: a.source_url ?? "",
    latitude: a.latitude != null ? String(a.latitude) : "",
    longitude: a.longitude != null ? String(a.longitude) : "",
    radius_m: a.radius_m != null ? String(a.radius_m) : "",
    starts_at: toLocalInput(a.starts_at),
    ends_at: toLocalInput(a.ends_at),
    mode,
  };
}

export function draftPoint(d: AnnouncementDraft): { latitude: number; longitude: number } | null {
  const lat = numberOrNull(d.latitude);
  const lng = numberOrNull(d.longitude);
  if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

export function hasArea(d: AnnouncementDraft): boolean {
  return d.latitude.trim() !== "" || d.longitude.trim() !== "";
}

function validUrl(v: string): boolean {
  if (v.length > ANNOUNCEMENT_SOURCE_URL_MAX) return false;
  try {
    const u = new URL(v);
    return (u.protocol === "http:" || u.protocol === "https:") && u.host !== "";
  } catch {
    return false;
  }
}

// The effective start once the mode is applied: "publish now" never waits
// for a future start.
export function effectiveStart(d: AnnouncementDraft, now: Date): Date | null {
  const start = parseLocal(d.starts_at);
  if (d.mode === "now" && (start == null || start > now)) return now;
  return start;
}

export function validateDraft(d: AnnouncementDraft, now: Date): DraftErrors {
  const errors: DraftErrors = {};
  if (!d.title.trim()) errors.title = "annErrTitle";
  if (!d.body.trim()) errors.body = "annErrBody";
  if (!d.source_name.trim()) errors.source_name = "annErrSource";
  if (d.source_url.trim() && !validUrl(d.source_url.trim())) errors.source_url = "annErrSourceUrl";
  if (hasArea(d) && !draftPoint(d)) errors.latitude = "annErrCoords";
  if (d.radius_m.trim() !== "") {
    const r = numberOrNull(d.radius_m);
    if (r == null || !Number.isInteger(r) || r < ANNOUNCEMENT_RADIUS_MIN_M || r > ANNOUNCEMENT_RADIUS_MAX_M) errors.radius_m = "annErrRadius";
  }
  const start = effectiveStart(d, now);
  if (!start) errors.starts_at = "annErrStart";
  else if (d.mode === "schedule" && start <= now) errors.starts_at = "annErrSchedule";
  const end = parseLocal(d.ends_at);
  if (start && end && end <= start) errors.ends_at = "annErrEnd";
  return errors;
}

// The create (POST) or update (PATCH) payload. On update, emptied optional
// fields are sent as explicit clears so stored values really go away; the
// publish state is changed separately via /publish · /unpublish.
export function draftToInput(
  d: AnnouncementDraft,
  images: DraftImage[],
  now: Date,
  original?: Pick<Announcement, "latitude" | "ends_at">,
): AnnouncementInput {
  const start = effectiveStart(d, now);
  const end = parseLocal(d.ends_at);
  const point = draftPoint(d);
  const radius = numberOrNull(d.radius_m);
  const input: AnnouncementInput = {
    title: d.title.trim(),
    body: d.body.trim(),
    type: d.type,
    severity: d.severity,
    source_name: d.source_name.trim(),
    images: images.map((img) => ({
      image_key: img.image_key,
      ...(img.width ? { width: img.width } : {}),
      ...(img.height ? { height: img.height } : {}),
    })),
    starts_at: start?.toISOString(),
  };
  const url = d.source_url.trim();
  // "" clears a stored link on update; omitted on create.
  if (url || original) input.source_url = url;
  if (point) {
    input.latitude = point.latitude;
    input.longitude = point.longitude;
    if (radius != null) input.radius_m = radius;
  }
  // A PATCH can't unset only the radius, so re-send the point without one.
  if (original && (!point || radius == null) && original.latitude != null) {
    input.clear_location = true;
  }
  if (end) input.ends_at = end.toISOString();
  else if (original?.ends_at) input.clear_ends_at = true;
  if (!original) input.publish = d.mode !== "draft";
  return input;
}

// Whether saving an edit must also flip the publish state.
export function publishChange(d: AnnouncementDraft, original: Pick<Announcement, "published_at">): boolean | null {
  const wantPublished = d.mode !== "draft";
  const isPublished = original.published_at != null;
  return wantPublished === isPublished ? null : wantPublished;
}
