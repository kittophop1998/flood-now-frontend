import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CCTV_NEARBY_LIMIT,
  CCTV_NEARBY_RADIUS_M,
  CCTV_REGION_MAX_AGE_MS,
  canReuseCctvRegion,
  cctvRoadLabel,
  cctvTitle,
  floodAreaBBox,
  withSelectedCamera,
} from "@/lib/cctv";
import { clusterPoints } from "@/lib/cluster";
import { DEFAULT_LAYERS } from "@/features/layers/use-viewport-layers";
import { CATEGORY_CHIPS } from "@/lib/map-filters";
import { en } from "@/lib/i18n/en";
import { th } from "@/lib/i18n/th";
import type { TranslateFn } from "@/lib/i18n/locale";
import type { CctvCamera } from "@/types/community";

const t: TranslateFn = (key, vars) => Object.entries(vars ?? {}).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), th[key]);

function camera(id: string, lat: number, lng: number, extra: Partial<CctvCamera> = {}): CctvCamera {
  return {
    id,
    external_id: id,
    name: `PER-${id}`,
    latitude: lat,
    longitude: lng,
    provider: "DOH",
    mode: "external_link",
    external_url: "https://highwaytraffic.go.th/DOHWeb/Home.aspx",
    status: "unknown",
    ...extra,
  };
}

test("CCTV layer is off by default and never a report category", () => {
  assert.equal(DEFAULT_LAYERS.dohCctv, false);
  assert.equal(DEFAULT_LAYERS.reports, true);
  for (const chip of CATEGORY_CHIPS) assert.doesNotMatch(chip.id, /cctv|camera/i);
});

test("a fetched camera region is reused while panning inside it, for a while", () => {
  const region = { bbox: { minLat: 13, maxLat: 14, minLng: 100, maxLng: 101 }, at: 1_000 };
  const inside = { minLat: 13.2, maxLat: 13.8, minLng: 100.2, maxLng: 100.8 };
  assert.equal(canReuseCctvRegion(region, inside, 2_000), true);
  assert.equal(canReuseCctvRegion(region, { ...inside, maxLat: 14.2 }, 2_000), false);
  assert.equal(canReuseCctvRegion(region, inside, 1_000 + CCTV_REGION_MAX_AGE_MS), false);
});

test("camera titles use DOH's road details and never invent any", () => {
  assert.equal(cctvTitle(camera("1", 13, 100, { highway_number: "1", km_marker: "91+900" }), t), "ทางหลวงหมายเลข 1 · กม. 91+900");
  assert.equal(cctvTitle(camera("2", 13, 100, { highway_number: "81" }), t), "ทางหลวงหมายเลข 81");
  assert.equal(cctvRoadLabel(camera("3", 13, 100), t), null);
  assert.equal(cctvTitle(camera("3", 13, 100), t), "รหัสจุด PER-3");
});

test("low zoom clusters cameras; high zoom shows each one", () => {
  // 30 cameras a few hundred meters apart along a road.
  const cams = Array.from({ length: 30 }, (_, i) => camera(String(i), 13.7 + i * 0.003, 100.5));
  const low = clusterPoints(cams, 8);
  assert.equal(low.length, 1);
  assert.equal(low[0].kind, "cluster");
  const high = clusterPoints(cams, 16);
  assert.equal(high.length, 30);
  assert.ok(high.every((c) => c.kind === "point"));
});

test("a camera opened from elsewhere stays on the map", () => {
  const listed = [camera("1", 13, 100)];
  assert.equal(withSelectedCamera(listed, listed[0]), listed);
  assert.equal(withSelectedCamera(listed, null), listed);
  assert.deepEqual(
    withSelectedCamera(listed, camera("9", 14, 101)).map((c) => c.id),
    ["1", "9"],
  );
});

test("a GISTDA area's box covers all its polygons", () => {
  const box = floodAreaBBox({
    type: "Feature",
    properties: { ref: 0 },
    geometry: {
      type: "MultiPolygon",
      coordinates: [
        [[[100, 13], [100.1, 13], [100.1, 13.1], [100, 13]]],
        [[[100.5, 13.5], [100.6, 13.5], [100.6, 13.6], [100.5, 13.5]]],
      ],
    },
  });
  assert.deepEqual(box, { minLat: 13, maxLat: 13.6, minLng: 100, maxLng: 100.6 });
  assert.equal(floodAreaBBox({ type: "Feature", properties: { ref: 1 }, geometry: { type: "MultiPolygon", coordinates: [] } }), null);
});

test("nearby cameras stay a short, close list", () => {
  assert.ok(CCTV_NEARBY_LIMIT >= 1 && CCTV_NEARBY_LIMIT <= 3);
  assert.ok(CCTV_NEARBY_RADIUS_M >= 500 && CCTV_NEARBY_RADIUS_M <= 1000);
});

test("CCTV labels exist in both languages, attribute DOH, and never claim live video", () => {
  const keys = Object.keys(en).filter((k) => /cctv/i.test(k)) as (keyof typeof en)[];
  assert.ok(keys.length > 25);
  for (const k of keys) {
    assert.ok(th[k].length > 0, k);
    assert.doesNotMatch(`${en[k]} ${th[k]}`, /\blive\b|สด|\b(API|HLS|m3u8|stream)\b/i, k);
  }
  assert.equal(th["layerCctvToggle"], "CCTV กรมทางหลวง");
  assert.equal(th["cctvOpenSource"], "ดูภาพจากกรมทางหลวง");
  assert.equal(th["cctvNearIncident"], "กล้องใกล้เหตุการณ์");
  assert.equal(th["cctvSourceLine"], "แหล่งข้อมูล: กรมทางหลวง Highway Traffic");
  assert.equal(th["cctvOffline"], "ไม่สามารถโหลดภาพจากกล้องขณะออฟไลน์");
});
