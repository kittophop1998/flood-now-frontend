import type { TranslateFn } from "@/lib/i18n/locale";

type LatLng = { latitude: number; longitude: number };

// Great-circle distance in meters (haversine). Good enough for "how far is
// this from me" — no external geocoding involved.
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number, t: TranslateFn): string {
  if (meters < 1000) return t("metersValue", { n: Math.max(50, Math.round(meters / 50) * 50) });
  // "5 km" rather than "5.0 km"; one decimal only when it carries information.
  const km = meters / 1000;
  return t("kilometersValue", { n: km < 10 ? Number(km.toFixed(1)).toString() : Math.round(km).toString() });
}

// "18 min", "1 h 5 min": travel time from the routing provider, rounded to a
// whole minute (never "0 min").
export function formatDuration(seconds: number, t: TranslateFn): string {
  const min = Math.max(1, Math.round(seconds / 60));
  if (min < 60) return t("durationMinutes", { n: min });
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${t("durationHours", { n: h })} ${t("durationMinutes", { n: m })}` : t("durationHours", { n: h });
}

// A circle of `radiusM` meters around a point as a GeoJSON ring
// ([lng, lat] pairs, closed), for drawing announcement areas on the map.
export function circleRing(center: LatLng, radiusM: number, steps = 48): [number, number][] {
  const ring: [number, number][] = [];
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.max(Math.cos((center.latitude * Math.PI) / 180), 0.01));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([center.longitude + dLng * Math.cos(a), center.latitude + dLat * Math.sin(a)]);
  }
  return ring;
}
