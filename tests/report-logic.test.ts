import { test } from "node:test";
import assert from "node:assert/strict";
import { clusterPoints, CLUSTER_MAX_ZOOM } from "@/lib/cluster";
import { currentStatus, isOpen } from "@/lib/report-status";
import { applyClientFilters, DEFAULT_FILTERS, toggleChipTypes, toListQuery } from "@/lib/map-filters";
import { CATEGORY_META, categoryLabel, hasKnownPassability, reportTitle, suggestPassability } from "@/lib/report-meta";
import { createReportFormSchema } from "@/lib/report-schema";
import { isInCooldown, RECONFIRM_COOLDOWN_MS } from "@/lib/confirmed-reports";
import { formatDistance } from "@/lib/distance";
import { freshnessLine } from "@/lib/freshness";
import { en } from "@/lib/i18n/en";
import { th } from "@/lib/i18n/th";
import type { TranslateFn } from "@/lib/i18n/locale";
import { CREATABLE_REPORT_TYPES, REPORT_TYPES, type Report } from "@/types/report";

const t: TranslateFn = (key, vars) =>
  en[key].replace(/\{(\w+)\}/g, (_, token: string) => String(vars?.[token] ?? ""));

const tTh: TranslateFn = (key) => th[key];

const NOW = new Date("2026-09-25T12:00:00Z");
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000).toISOString();

function report(overrides: Partial<Report> = {}): Report {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    type: "flooded",
    severity: "high",
    status: "active",
    latitude: 13.7563,
    longitude: 100.5018,
    geometry_type: "point",
    water_depth: "knee",
    water_level_cm: null,
    passability: null,
    description: null,
    image_key: null,
    image_url: null,
    people_count: null,
    has_child: null,
    has_elderly: null,
    contact_phone: null,
    created_at: minutes(-30),
    updated_at: minutes(-30),
    last_verified_at: minutes(-30),
    stale_at: minutes(90),
    expires_at: minutes(330),
    resolved_at: null,
    is_expired: false,
    still_active_count: 0,
    cleared_count: 0,
    ...overrides,
  };
}

test("i18n: Thai dictionary covers every English key", () => {
  assert.deepEqual(Object.keys(th).sort(), Object.keys(en).sort());
  for (const [key, value] of Object.entries(th)) assert.ok(value.trim(), `empty Thai string for ${key}`);
});

test("currentStatus re-derives lifecycle from server timestamps", () => {
  assert.equal(currentStatus(report(), NOW), "active");
  assert.equal(currentStatus(report({ stale_at: minutes(-1) }), NOW), "possibly_stale");
  assert.equal(currentStatus(report({ stale_at: minutes(-10), expires_at: minutes(-1) }), NOW), "expired");
  assert.equal(currentStatus(report({ resolved_at: minutes(-5), expires_at: minutes(-1) }), NOW), "resolved");
  assert.ok(isOpen("possibly_stale") && !isOpen("resolved") && !isOpen("expired"));
});

test("toListQuery never asks the map for resolved or expired reports", () => {
  assert.deepEqual(toListQuery(DEFAULT_FILTERS, NOW).statuses, ["active", "possibly_stale"]);
  const q = toListQuery({ ...DEFAULT_FILTERS, activeOnly: true, updatedWithinMin: 60, types: ["flooded"] }, NOW);
  assert.deepEqual(q.statuses, ["active"]);
  assert.deepEqual(q.types, ["flooded"]);
  assert.equal(q.updatedSince, minutes(-60));
  assert.equal(toListQuery(DEFAULT_FILTERS, NOW).types, undefined);
});

test("applyClientFilters: distance, blocked-for vehicle, and locally upserted reports", () => {
  const near = report({ id: "near" });
  const far = report({ id: "far", latitude: 13.9 });
  const blocked = report({
    id: "blocked",
    passability: { walk: "passable", motorcycle: "impassable", sedan: "not_recommended", suv_pickup: "passable" },
  });
  const stale = report({ id: "stale", stale_at: minutes(-1) });
  const resolved = report({ id: "resolved", resolved_at: minutes(-1), status: "resolved" });
  const me = { latitude: 13.7563, longitude: 100.5018 };
  const all = [near, far, blocked, stale, resolved];

  const ids = (rs: Report[]) => rs.map((r) => r.id).sort();
  assert.deepEqual(ids(applyClientFilters(all, DEFAULT_FILTERS, me, NOW)), ["blocked", "far", "near", "stale"]);
  assert.deepEqual(ids(applyClientFilters(all, { ...DEFAULT_FILTERS, nearMe: true, radiusKm: 1 }, me, NOW)), ["blocked", "near", "stale"]);
  assert.deepEqual(ids(applyClientFilters(all, { ...DEFAULT_FILTERS, blockedFor: "sedan" }, me, NOW)), ["blocked"]);
  assert.deepEqual(ids(applyClientFilters(all, { ...DEFAULT_FILTERS, blockedFor: "suv_pickup" }, me, NOW)), []);
  assert.deepEqual(ids(applyClientFilters(all, { ...DEFAULT_FILTERS, activeOnly: true }, me, NOW)), ["blocked", "far", "near"]);
  assert.deepEqual(ids(applyClientFilters(all, { ...DEFAULT_FILTERS, types: ["accident"] }, me, NOW)), []);
});

test("toggleChipTypes toggles a multi-type chip as a unit", () => {
  assert.deepEqual(toggleChipTypes([], ["shelter", "aid_point"]), ["shelter", "aid_point"]);
  assert.deepEqual(toggleChipTypes(["flooded", "shelter", "aid_point"], ["shelter", "aid_point"]), ["flooded"]);
  assert.deepEqual(toggleChipTypes(["shelter"], ["shelter", "aid_point"]), ["shelter", "aid_point"]);
});

test("clusterPoints bounds marker count and keeps bubbles apart", () => {
  const dense = Array.from({ length: 500 }, (_, i) =>
    report({ id: `r${i}`, latitude: 13.75 + (i % 25) * 0.0004, longitude: 100.5 + Math.floor(i / 25) * 0.0004 }),
  );
  const low = clusterPoints(dense, 12);
  assert.ok(low.length < 20, `expected heavy clustering at z12, got ${low.length} markers`);
  const counted = low.reduce((n, c) => n + (c.kind === "cluster" ? c.items.length : 1), 0);
  assert.equal(counted, dense.length, "every report belongs to exactly one marker");

  const high = clusterPoints(dense, CLUSTER_MAX_ZOOM);
  assert.equal(high.length, dense.length);
  assert.ok(high.every((c) => c.kind === "point"));

  const isolated = [report({ id: "a" }), report({ id: "b", latitude: 14.5 })];
  assert.ok(clusterPoints(isolated, 12).every((c) => c.kind === "point"));
});

test("suggestPassability gets stricter as water rises", () => {
  assert.equal(suggestPassability("unknown"), null);
  assert.equal(suggestPassability("ankle")?.sedan, "passable");
  assert.equal(suggestPassability("knee")?.motorcycle, "impassable");
  assert.equal(suggestPassability("above_knee")?.sedan, "impassable");
  assert.ok(!hasKnownPassability({ walk: "unknown", motorcycle: "unknown", sedan: "unknown", suv_pickup: "unknown" }));
  assert.ok(hasKnownPassability(suggestPassability("shin")));
});

test("reportTitle and freshnessLine answer what + how current", () => {
  assert.equal(reportTitle(t, report({ water_depth: "knee" })), "Flood · Knee-deep");
  assert.equal(reportTitle(t, report({ water_depth: "unknown" })), "Flood");
  assert.equal(reportTitle(t, report({ type: "help_needed", people_count: 3 })), "Help needed · 3 people");
  assert.equal(freshnessLine(report({ last_verified_at: minutes(-8) }), t, NOW), "Updated 8 min ago");
  assert.equal(freshnessLine(report({ last_verified_at: minutes(-3), still_active_count: 2 }), t, NOW), "Confirmed 3 min ago");
});

test("isInCooldown blocks only an accidental repeat of the same vote", () => {
  const now = Date.now();
  const entry = { status: "still_active" as const, at: now - 60_000 };
  assert.ok(isInCooldown(entry, "still_active", now));
  assert.ok(!isInCooldown(entry, "cleared", now));
  assert.ok(!isInCooldown({ ...entry, at: now - RECONFIRM_COOLDOWN_MS - 1 }, "still_active", now));
  assert.ok(!isInCooldown(null, "still_active", now));
});

test("formatDistance rounds to useful precision", () => {
  assert.equal(formatDistance(20, t), "50 m");
  assert.equal(formatDistance(430, t), "450 m");
  assert.equal(formatDistance(5000, t), "5 km");
  assert.equal(formatDistance(2340, t), "2.3 km");
  assert.equal(formatDistance(12_400, t), "12 km");
});

test("new-report categories exclude the SOS cases; the form schema enforces it", () => {
  // The CategoryPicker renders exactly this list.
  assert.deepEqual(
    CREATABLE_REPORT_TYPES.map((type) => categoryLabel(tTh, type)),
    ["น้ำท่วม", "ถนนปิด", "อุบัติเหตุ", "สิ่งกีดขวาง", "ไฟดับ", "ศูนย์พักพิง", "จุดช่วยเหลือ"],
  );
  const schema = createReportFormSchema(t);
  for (const type of CREATABLE_REPORT_TYPES) {
    assert.ok(schema.safeParse({ type, severity: "high" }).success, type);
  }
  for (const type of ["vehicle_stalled", "help_needed", "other"]) {
    assert.ok(!(CREATABLE_REPORT_TYPES as readonly string[]).includes(type), type);
    assert.ok(!schema.safeParse({ type, severity: "high" }).success, type);
  }
});

test("stored reports with retired categories still render with their own label and icon", () => {
  // Filters/detail/markers read from the full REPORT_TYPES set.
  for (const type of ["vehicle_stalled", "help_needed", "other"] as const) {
    assert.ok(REPORT_TYPES.includes(type));
    assert.ok(CATEGORY_META[type].icon);
  }
  assert.equal(categoryLabel(tTh, "vehicle_stalled"), "รถเสีย/รถดับ");
  assert.equal(categoryLabel(tTh, "help_needed"), "ขอความช่วยเหลือ");
  assert.equal(categoryLabel(tTh, "other"), "อื่น ๆ");
  assert.equal(CATEGORY_META.vehicle_stalled.fields.passability, true);
  assert.equal(CATEGORY_META.help_needed.fields.helpDetails, true);
  assert.equal(reportTitle(t, report({ type: "vehicle_stalled", water_depth: null })), "Broken-down vehicle");
});
