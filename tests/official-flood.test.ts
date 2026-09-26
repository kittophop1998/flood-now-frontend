import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GISTDA_PERIOD,
  FLOOD_REGION_MAX_AGE_MS,
  canReuseFloodRegion,
  countFloodPositions,
  floodCacheKey,
  padFloodBBox,
} from "@/lib/official-flood";
import { DEFAULT_LAYERS } from "@/features/layers/use-viewport-layers";
import { CATEGORY_CHIPS } from "@/lib/map-filters";
import { en } from "@/lib/i18n/en";
import { th } from "@/lib/i18n/th";
import { GISTDA_PERIODS, type FloodLayer } from "@/types/community";

const view = { bbox: { minLat: 13.7, maxLat: 13.8, minLng: 100.5, maxLng: 100.6 }, zoom: 13 };

test("GISTDA layer is off by default and defaults to the latest 24 hours", () => {
  assert.equal(DEFAULT_LAYERS.gistdaFlood, false);
  assert.equal(DEFAULT_LAYERS.gistdaPeriod, "1d");
  assert.equal(DEFAULT_GISTDA_PERIOD, "1d");
  assert.equal(DEFAULT_LAYERS.reports, true);
  assert.deepEqual([...GISTDA_PERIODS], ["1d", "3d", "7d", "30d"]);
});

test("GISTDA is a map layer, never a report category chip", () => {
  for (const chip of CATEGORY_CHIPS) {
    assert.ok(!/gistda|official/i.test(chip.id));
  }
});

test("a fetched flood region is reused while panning inside it", () => {
  const bbox = padFloodBBox(view.bbox);
  assert.ok(bbox.minLat < view.bbox.minLat && bbox.maxLng > view.bbox.maxLng);
  const region = { bbox, zoom: view.zoom, at: 1_000 };
  const panned = { ...view, bbox: { minLat: 13.72, maxLat: 13.82, minLng: 100.52, maxLng: 100.62 } };
  assert.equal(canReuseFloodRegion(region, panned, 2_000), true);
  // Zooming in one level keeps the copy; zooming in further wants finer shapes.
  assert.equal(canReuseFloodRegion(region, { ...view, zoom: 14 }, 2_000), true);
  assert.equal(canReuseFloodRegion(region, { ...view, zoom: 14.5 }, 2_000), false);
  // Leaving the region or an old copy means a new request.
  const away = { ...view, bbox: { minLat: 14, maxLat: 14.1, minLng: 100.5, maxLng: 100.6 } };
  assert.equal(canReuseFloodRegion(region, away, 2_000), false);
  assert.equal(canReuseFloodRegion(region, view, 1_000 + FLOOD_REGION_MAX_AGE_MS), false);
});

test("padding stays within world bounds", () => {
  const b = padFloodBBox({ minLat: -89, maxLat: 89, minLng: -179, maxLng: 179 });
  assert.deepEqual(b, { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 });
});

test("offline copies are sized by position count and keyed per period", () => {
  const layer: FloodLayer = {
    source: "GISTDA",
    period: "3d",
    observed_at: null,
    fetched_at: "2026-09-26T03:00:00Z",
    stale: false,
    source_url: "https://disaster.gistda.or.th",
    has_more: false,
    areas: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { ref: 0 },
          geometry: {
            type: "MultiPolygon",
            coordinates: [
              [
                [[100, 13], [100.1, 13], [100.1, 13.1], [100, 13]],
                [[100.02, 13.02], [100.03, 13.02], [100.03, 13.03], [100.02, 13.02]],
              ],
            ],
          },
        },
      ],
    },
  };
  assert.equal(countFloodPositions(layer), 8);
  assert.notEqual(floodCacheKey("1d"), floodCacheKey("30d"));
});

test("every GISTDA label exists in both languages and never uses technical terms", () => {
  const keys = Object.keys(en).filter((k) => /gistda|layerSection|layerReportsToggle/i.test(k)) as (keyof typeof en)[];
  assert.ok(keys.length > 20);
  for (const p of GISTDA_PERIODS) {
    assert.ok(`gistdaPeriod.${p}` in en && `gistdaPeriodLong.${p}` in en);
  }
  for (const k of keys) {
    assert.ok(th[k].length > 0, k);
    assert.doesNotMatch(`${en[k]} ${th[k]}`, /\b(WMS|TMS|WMTS|GeoJSON|API)\b/, k);
  }
  assert.equal(th["layerGistdaToggle"], "พื้นที่น้ำท่วม GISTDA");
  assert.equal(th["gistdaPeriod.1d"], "24 ชม.");
  assert.equal(th["gistdaLoadFailed"], "โหลดข้อมูล GISTDA ไม่สำเร็จ");
});
