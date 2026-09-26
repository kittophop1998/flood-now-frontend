// Client rules for the official DOH highway camera layer: how a camera is
// named, which fetched region a copy is still good for, and the nearby
// lookups. Only camera metadata is handled — pictures stay on DOH's page.
import type { TranslateFn } from "@/lib/i18n/locale";
import type { BoundingBox } from "@/types/report";
import type { CctvCamera, FloodAreaCollection } from "@/types/community";

export const CCTV_CACHE_KEY = "doh-cctv";
// The API refreshes the camera list about hourly; a fetched region is reused
// while the map moves inside it for this long.
export const CCTV_REGION_MAX_AGE_MS = 10 * 60_000;
// "Cameras near this incident": within this radius, at most this many.
export const CCTV_NEARBY_RADIUS_M = 1000;
export const CCTV_NEARBY_LIMIT = 3;
// Cameras counted inside a GISTDA flood area's extent.
export const CCTV_AREA_LIMIT = 50;

export interface FetchedCctvRegion {
  bbox: BoundingBox;
  at: number;
}

// True when the region fetched earlier still covers the view — then the map
// moves without any request.
export function canReuseCctvRegion(region: FetchedCctvRegion, view: BoundingBox, now: number): boolean {
  const r = region.bbox;
  return (
    now - region.at < CCTV_REGION_MAX_AGE_MS &&
    view.minLat >= r.minLat &&
    view.maxLat <= r.maxLat &&
    view.minLng >= r.minLng &&
    view.maxLng <= r.maxLng
  );
}

// "Highway 1 · km 91+900" when DOH gave road details, else null.
export function cctvRoadLabel(camera: CctvCamera, t: TranslateFn): string | null {
  const road = camera.highway_number;
  if (!road) return null;
  return camera.km_marker ? t("cctvHighwayKm", { road, km: camera.km_marker }) : t("cctvHighway", { road });
}

// The camera's title: its road/km if known, otherwise DOH's station code.
export function cctvTitle(camera: CctvCamera, t: TranslateFn): string {
  return cctvRoadLabel(camera, t) ?? t("cctvStation", { code: camera.name });
}

// The bounding box of one GISTDA flood area, for "cameras near this area".
export function floodAreaBBox(feature: FloodAreaCollection["features"][number]): BoundingBox | null {
  let [minLng, minLat, maxLng, maxLat] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const poly of feature.geometry.coordinates)
    for (const ring of poly)
      for (const [lng, lat] of ring) {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
  return Number.isFinite(minLng) ? { minLat, maxLat, minLng, maxLng } : null;
}

// Keeps the selected camera on the map even when it's outside the fetched
// list (opened from an incident's nearby cameras).
export function withSelectedCamera(cameras: CctvCamera[], selected: CctvCamera | null): CctvCamera[] {
  if (!selected || cameras.some((c) => c.id === selected.id)) return cameras;
  return [...cameras, selected];
}
