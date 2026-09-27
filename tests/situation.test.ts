import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeSituation } from "@/lib/situation";
import { CATEGORY_CHIPS, countAdvancedFilters, DEFAULT_FILTERS, SEVERE } from "@/lib/map-filters";
import { CATEGORY_DETAILS, CATEGORY_META, keyDetail, knownDetails, reportTitle } from "@/lib/report-meta";
import { conditionChanges, conditionDraftFrom } from "@/lib/condition-update";
import { reportShareText } from "@/lib/share";
import { en } from "@/lib/i18n/en";
import { th } from "@/lib/i18n/th";
import type { TranslateFn } from "@/lib/i18n/locale";
import { REPORT_TYPES, type Report } from "@/types/report";

const t: TranslateFn = (key, vars) => en[key].replace(/\{(\w+)\}/g, (_, token: string) => String(vars?.[token] ?? ""));
const tTh: TranslateFn = (key, vars) => th[key].replace(/\{(\w+)\}/g, (_, token: string) => String(vars?.[token] ?? ""));

const NOW = new Date("2026-09-25T12:00:00Z");
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000).toISOString();

function report(overrides: Partial<Report> = {}): Report {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    type: "accident",
    severity: "moderate",
    status: "active",
    latitude: 13.7563,
    longitude: 100.5018,
    geometry_type: "point",
    water_depth: null,
    water_level_cm: null,
    passability: null,
    details: null,
    description: null,
    image_key: null,
    image_url: null,
    people_count: null,
    has_child: null,
    has_elderly: null,
    contact_phone: null,
    created_at: minutes(-180),
    updated_at: minutes(-180),
    last_verified_at: minutes(-180),
    stale_at: minutes(60),
    expires_at: minutes(300),
    resolved_at: null,
    is_expired: false,
    still_active_count: 0,
    cleared_count: 0,
    like_count: 0,
    support_count: 0,
    distance_m: 2000,
    ...overrides,
  };
}

const ids = (rs: Report[]) => rs.map((r) => r.id);

test("situation: severe first, then very near, then recent, then travel impact, then nearest", () => {
  const all = [
    report({ id: "outage-far", type: "power_outage", distance_m: 3000 }),
    report({ id: "accident-far", distance_m: 2500 }),
    report({ id: "recent-far", distance_m: 4000, last_verified_at: minutes(-10) }),
    report({ id: "near-minor", severity: "low", distance_m: 650 }),
    report({ id: "severe-far", severity: "high", distance_m: 4800 }),
    report({ id: "critical-far", type: "road_closed", severity: "critical", distance_m: 4900 }),
  ];
  const s = summarizeSituation(all, NOW);
  assert.deepEqual(ids(s.incidents), ["critical-far", "severe-far", "near-minor", "recent-far", "accident-far", "outage-far"]);
  assert.equal(s.top?.id, "critical-far");
});

test("situation: flood is not favoured over other categories", () => {
  const s = summarizeSituation(
    [report({ id: "flood", type: "flooded", water_depth: "shin", distance_m: 1500 }), report({ id: "closure", type: "road_closed", distance_m: 1200 })],
    NOW,
  );
  assert.equal(s.top?.id, "closure", "same tier → the nearer one, whatever the category");
});

test("situation: may-be-outdated reports never lead; closed ones and facilities are left out", () => {
  const s = summarizeSituation(
    [
      report({ id: "stale-critical", severity: "critical", distance_m: 100, stale_at: minutes(-5) }),
      report({ id: "fresh-minor", severity: "low", distance_m: 3000 }),
      report({ id: "resolved", resolved_at: minutes(-1), status: "resolved" }),
      report({ id: "expired", expires_at: minutes(-1) }),
      report({ id: "shelter", type: "shelter", distance_m: 50 }),
      report({ id: "aid", type: "aid_point", distance_m: 60 }),
    ],
    NOW,
  );
  assert.deepEqual(ids(s.incidents), ["fresh-minor", "stale-critical"]);
});

test("situation: nothing nearby is an explicit empty state, not an error", () => {
  const s = summarizeSituation([report({ type: "shelter" })], NOW);
  assert.deepEqual(s.incidents, []);
  assert.equal(s.top, null);
});

test("category details: each category only shows its own fields; flood keeps depth", () => {
  const accident = report({ details: { lanes_blocked: "one", traffic_impact: "slow", closure: "full", water: "deep" } });
  assert.deepEqual(knownDetails("accident", accident.details).map(([f, v]) => `${f.key}=${v}`), ["lanes_blocked=one", "traffic_impact=slow"]);
  assert.equal(reportTitle(t, accident), "Accident · 1 lane blocked");
  assert.equal(reportTitle(tTh, accident), "อุบัติเหตุ · ปิด 1 ช่องทาง");

  const closure = report({ type: "road_closed", details: { closure: "partial" } });
  assert.equal(keyDetail(tTh, closure), "ปิดบางส่วน");

  const damage = report({ type: "road_damage", details: { damage_type: "subsidence" } });
  assert.equal(keyDetail(tTh, damage), "ถนนทรุด");

  // Legacy flood rows have no details at all and still read the same.
  const flood = report({ type: "flooded", water_depth: "knee", details: undefined });
  assert.equal(reportTitle(t, flood), "Flood · Knee-deep");
  assert.deepEqual(knownDetails("flooded", { lanes_blocked: "all" }), []);
  assert.equal(CATEGORY_META.flooded.fields.waterDepth && CATEGORY_META.flooded.fields.passability, true);

  // An unknown value (e.g. from a newer API) is ignored rather than shown raw.
  assert.equal(keyDetail(t, report({ details: { lanes_blocked: "seven" } })), null);
  assert.equal(reportTitle(t, report({ details: null })), "Accident");
});

test("category details: every option has a label in both languages", () => {
  for (const [type, fields] of Object.entries(CATEGORY_DETAILS)) {
    assert.ok(REPORT_TYPES.includes(type as Report["type"]), type);
    for (const f of fields!) {
      assert.ok(`detail.${f.key}` in en, `detail.${f.key}`);
      for (const o of f.options) assert.ok(`detailValue.${f.key}.${o}` in th, `detailValue.${f.key}.${o}`);
    }
  }
});

test("condition update sends only changed details", () => {
  const r = report({ details: { lanes_blocked: "one" } });
  assert.deepEqual(conditionChanges(r, conditionDraftFrom(r)), {});
  const draft = { ...conditionDraftFrom(r), details: { lanes_blocked: "all", traffic_impact: "standstill" } };
  assert.deepEqual(conditionChanges(r, draft), { details: { lanes_blocked: "all", traffic_impact: "standstill" } });
  const outage = report({ type: "power_outage" });
  assert.deepEqual(conditionChanges(outage, { ...conditionDraftFrom(outage), details: { lanes_blocked: "all" } }), {});
});

test("share text works for any category and carries details + place", () => {
  const text = reportShareText(tTh, report({ details: { lanes_blocked: "one", traffic_impact: "slow" }, last_verified_at: minutes(-5) }), NOW, "ถนนพระราม 4");
  const lines = text.split("\n");
  assert.equal(lines[0], "อุบัติเหตุ · ปิด 1 ช่องทาง — ปานกลาง");
  assert.equal(lines[1], "ถนนพระราม 4");
  assert.equal(lines[2], "รถติด");
  assert.match(lines[3], /อัปเดตล่าสุด 5 นาทีที่แล้ว/);
  assert.match(text, /FloodNow/);
});

test("filters: every category is reachable from the sheet exactly once; the map shows only two quick toggles", () => {
  const covered = CATEGORY_CHIPS.flatMap((c) => c.types);
  assert.deepEqual([...covered].sort(), [...REPORT_TYPES].sort());
  assert.equal(new Set(covered).size, covered.length);

  assert.equal(countAdvancedFilters(DEFAULT_FILTERS), 0);
  assert.equal(countAdvancedFilters({ ...DEFAULT_FILTERS, nearMe: true, activeOnly: true }), 0, "quick toggles aren't counted");
  assert.equal(countAdvancedFilters({ ...DEFAULT_FILTERS, types: ["accident"], severities: SEVERE, updatedWithinMin: 120 }), 3);
});
