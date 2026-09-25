import { test } from "node:test";
import assert from "node:assert/strict";
import { crc16, maskPromptPayId, normalizeAmount, promptPayPayload } from "@/lib/promptpay";
import { applySyncResult, enqueue, MAX_OUTBOX_ITEMS, type OutboxItem } from "@/lib/outbox";
import { reportShareText } from "@/lib/share";
import { circleRing, distanceMeters } from "@/lib/distance";
import { tripDirectionsUrl } from "@/lib/directions";
import { en } from "@/lib/i18n/en";
import type { TranslateFn } from "@/lib/i18n/locale";
import type { Report } from "@/types/report";

const t: TranslateFn = (key, vars) =>
  en[key].replace(/\{(\w+)\}/g, (_, token: string) => String(vars?.[token] ?? ""));

// Reference payloads produced by the widely used `promptpay-qr` package.
test("promptPayPayload matches reference EMVCo payloads", () => {
  assert.equal(
    promptPayPayload({ promptpay_id: "0812345678", id_type: "phone" }),
    "00020101021129370016A000000677010111011300668123456785802TH530376463045D82",
  );
  assert.equal(
    promptPayPayload({ promptpay_id: "0812345678", id_type: "phone" }, 100),
    "00020101021229370016A000000677010111011300668123456785802TH53037645406100.006304BB8A",
  );
  assert.equal(
    promptPayPayload({ promptpay_id: "1101700207030", id_type: "national_id" }, 20.5),
    "00020101021229370016A000000677010111021311017002070305802TH5303764540520.506304E68D",
  );
  assert.equal(
    promptPayPayload({ promptpay_id: "123456789012345", id_type: "ewallet" }),
    "00020101021129390016A00000067701011103151234567890123455802TH5303764630473AF",
  );
});

test("promptPay amounts: invalid or empty means 'payer enters amount'", () => {
  assert.equal(normalizeAmount(""), null);
  assert.equal(normalizeAmount("0"), null);
  assert.equal(normalizeAmount("-5"), null);
  assert.equal(normalizeAmount("abc"), null);
  assert.equal(normalizeAmount("1,250.555"), 1250.56);
  assert.equal(normalizeAmount(50), 50);
  const staticQr = promptPayPayload({ promptpay_id: "0812345678", id_type: "phone" }, null);
  assert.ok(staticQr.includes("010211") && !staticQr.includes("5406"), "no amount → static QR without tag 54");
  assert.equal(crc16("123456789"), "29B1", "CRC-16/CCITT-FALSE check value");
  assert.equal(maskPromptPayId({ promptpay_id: "0812345678", id_type: "phone" }), "081-xxx-5678");
});

function item(id: string, extra: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id,
    kind: "report",
    payload: { type: "flooded", severity: "high", latitude: 13.75, longitude: 100.5, client_id: id },
    createdAt: "2026-09-25T08:00:00Z",
    attempts: 0,
    status: "pending",
    ...extra,
  } as OutboxItem;
}

test("outbox: a newer vote on the same report replaces the queued one", () => {
  const vote = (id: string, reportId: string, status: "still_active" | "cleared"): OutboxItem => ({
    id,
    kind: "confirm",
    reportId,
    payload: { status },
    createdAt: "2026-09-25T08:00:00Z",
    attempts: 0,
    status: "pending",
  });
  let q = enqueue([], vote("v1", "r1", "still_active"));
  q = enqueue(q, vote("v2", "r2", "still_active"));
  q = enqueue(q, vote("v3", "r1", "cleared"));
  assert.deepEqual(
    q.map((i) => i.id),
    ["v2", "v3"],
  );
  // Reports are never merged: each is its own submission.
  q = enqueue(enqueue([], item("a")), item("b"));
  assert.equal(q.length, 2);
  const many = Array.from({ length: MAX_OUTBOX_ITEMS + 5 }, (_, i) => item(`x${i}`)).reduce(enqueue, [] as OutboxItem[]);
  assert.equal(many.length, MAX_OUTBOX_ITEMS);
});

test("outbox: sync results remove, keep pending, or fail items", () => {
  const q = [item("a"), item("b")];
  assert.deepEqual(
    applySyncResult(q, "a", { ok: true }).map((i) => i.id),
    ["b"],
  );
  const offline = applySyncResult(q, "a", { ok: false, retryable: true, error: "offline" });
  assert.equal(offline[0].status, "pending");
  assert.equal(offline[0].attempts, 1);
  const rejected = applySyncResult(q, "b", { ok: false, retryable: false, error: "invalid" });
  assert.equal(rejected[1].status, "failed");
  assert.equal(rejected[1].error, "invalid");
});

test("share text is a deterministic summary of the incident", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  const report = {
    id: "r1",
    type: "flooded",
    severity: "critical",
    status: "active",
    latitude: 13.75,
    longitude: 100.5,
    geometry_type: "point",
    water_depth: "above_knee",
    water_level_cm: null,
    passability: { walk: "impassable", motorcycle: "impassable", sedan: "impassable", suv_pickup: "unknown" },
    description: null,
    image_key: null,
    image_url: null,
    people_count: null,
    has_child: null,
    has_elderly: null,
    contact_phone: null,
    created_at: "2026-09-25T11:30:00Z",
    updated_at: "2026-09-25T11:55:00Z",
    last_verified_at: "2026-09-25T11:55:00Z",
    stale_at: "2026-09-25T13:55:00Z",
    expires_at: "2026-09-25T17:55:00Z",
    resolved_at: null,
    is_expired: false,
    still_active_count: 3,
    cleared_count: 0,
  } satisfies Report;
  const text = reportShareText(t, report, now);
  assert.equal(
    text,
    [
      "Flood · Above knee — Critical",
      "Walking: Can't pass · Motorcycle: Can't pass · Car: Can't pass",
      "Confirmed 5 min ago · 3 confirmed",
      en.shareFooter,
    ].join("\n"),
  );
  assert.equal(reportShareText(t, report, now), text, "same input, same text");
  const stale = reportShareText(t, { ...report, stale_at: "2026-09-25T11:59:00Z" }, now);
  assert.ok(stale.includes("May be outdated"), "freshness is part of the card");
});

test("circleRing approximates the announcement radius", () => {
  const center = { latitude: 13.75, longitude: 100.5 };
  const ring = circleRing(center, 5000, 36);
  assert.equal(ring.length, 37);
  assert.deepEqual(ring[0], ring[36], "ring is closed");
  for (const [lng, lat] of ring) {
    const d = distanceMeters(center, { latitude: lat, longitude: lng });
    assert.ok(Math.abs(d - 5000) < 60, `vertex at ${d.toFixed(0)} m`);
  }
});

test("trip hand-off uses walking directions only for pedestrians", () => {
  const a = { latitude: 13.75, longitude: 100.5 };
  const b = { latitude: 13.76, longitude: 100.51 };
  assert.ok(tripDirectionsUrl(a, b, true).includes("travelmode=walking"));
  assert.ok(tripDirectionsUrl(a, b, false).includes("travelmode=driving"));
  assert.ok(tripDirectionsUrl(a, b, false).includes("origin=13.75%2C100.5"));
});

test("install prompt: phones only, once, never when already installed", async () => {
  const { installModeFor } = await import("@/lib/install-prompt");
  const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36";
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1";
  const ipad = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15";
  const desktop = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36";
  const base = { maxTouchPoints: 5, standalone: false, seen: false, nativePromptAvailable: false };

  assert.equal(installModeFor({ ...base, userAgent: android, nativePromptAvailable: true }), "native");
  assert.equal(installModeFor({ ...base, userAgent: android }), "manual");
  assert.equal(installModeFor({ ...base, userAgent: iphone }), "ios");
  assert.equal(installModeFor({ ...base, userAgent: ipad }), "ios", "iPadOS reports as a Mac");
  assert.equal(installModeFor({ ...base, userAgent: desktop, maxTouchPoints: 0 }), null);
  assert.equal(installModeFor({ ...base, userAgent: ipad, maxTouchPoints: 0 }), null, "a real Mac is desktop");
  assert.equal(installModeFor({ ...base, userAgent: iphone, seen: true }), null);
  assert.equal(installModeFor({ ...base, userAgent: android, standalone: true, nativePromptAvailable: true }), null);
});
