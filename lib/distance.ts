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
  return t("kilometersValue", { n: (meters / 1000).toFixed(meters < 10_000 ? 1 : 0) });
}
