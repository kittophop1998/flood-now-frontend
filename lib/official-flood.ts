// Client rules for the official GISTDA flood layer: which region/zoom a
// fetched copy is still good for, and what's small enough to keep offline.
// The layer is area-level satellite data, kept apart from community reports.
import type { BoundingBox } from "@/types/report";
import type { FloodAreaCollection, FloodLayer, GistdaPeriod } from "@/types/community";

export const DEFAULT_GISTDA_PERIOD: GistdaPeriod = "1d";

export const EMPTY_FLOOD_AREAS: FloodAreaCollection = { type: "FeatureCollection", features: [] };

// Fetch a margin around the view so small pans reuse the same copy.
const PAD_RATIO = 0.5;
// The server simplifies shapes for the requested area's size; zooming in
// more than this past the fetch zoom needs finer shapes.
const MAX_ZOOM_IN = 1;
// A fetched copy is reused for this long (the API caches GISTDA for ~15 min).
export const FLOOD_REGION_MAX_AGE_MS = 5 * 60_000;
// Offline copies above this many positions are skipped so one layer can't
// crowd the device cache that reports and saved places rely on.
export const FLOOD_CACHE_MAX_POSITIONS = 20_000;

export interface FetchedFloodRegion {
  bbox: BoundingBox;
  zoom: number;
  at: number;
}

export function padFloodBBox(b: BoundingBox): BoundingBox {
  const dLat = (b.maxLat - b.minLat) * PAD_RATIO;
  const dLng = (b.maxLng - b.minLng) * PAD_RATIO;
  return {
    minLat: Math.max(-90, b.minLat - dLat),
    maxLat: Math.min(90, b.maxLat + dLat),
    minLng: Math.max(-180, b.minLng - dLng),
    maxLng: Math.min(180, b.maxLng + dLng),
  };
}

// True when a copy fetched for `region` still covers the view at adequate
// detail — then the map moves without any request.
export function canReuseFloodRegion(region: FetchedFloodRegion, view: { bbox: BoundingBox; zoom: number }, now: number): boolean {
  const b = view.bbox;
  const r = region.bbox;
  return (
    now - region.at < FLOOD_REGION_MAX_AGE_MS &&
    view.zoom - region.zoom <= MAX_ZOOM_IN &&
    b.minLat >= r.minLat &&
    b.maxLat <= r.maxLat &&
    b.minLng >= r.minLng &&
    b.maxLng <= r.maxLng
  );
}

export function countFloodPositions(layer: FloodLayer): number {
  let n = 0;
  for (const f of layer.areas.features) for (const poly of f.geometry.coordinates) for (const ring of poly) n += ring.length;
  return n;
}

export function floodCacheKey(period: GistdaPeriod): string {
  return `gistda-flood:${period}`;
}
