import { distanceMeters } from "@/lib/distance";
import { currentStatus, isOpen } from "@/lib/report-status";
import type { ListReportsQuery, Report, ReportType, Severity, Vehicle } from "@/types/report";

// Category chips on the map. Shelter and aid point share one chip — both
// answer "where can I get help/shelter".
export const CATEGORY_CHIPS: { id: string; types: ReportType[] }[] = [
  { id: "flooded", types: ["flooded"] },
  { id: "road_closed", types: ["road_closed"] },
  { id: "accident", types: ["accident"] },
  { id: "obstruction", types: ["obstruction"] },
  { id: "vehicle_stalled", types: ["vehicle_stalled"] },
  { id: "help_needed", types: ["help_needed"] },
  { id: "facilities", types: ["shelter", "aid_point"] },
];

export const RADIUS_OPTIONS_KM = [1, 3, 5, 10] as const;
export const UPDATED_WITHIN_OPTIONS_MIN = [60, 180, 360] as const;
export const SEVERE: Severity[] = ["high", "critical"];

export interface MapFilters {
  types: ReportType[]; // empty = all categories
  severities: Severity[]; // empty = all
  activeOnly: boolean; // hide "possibly stale"
  nearMe: boolean;
  radiusKm: (typeof RADIUS_OPTIONS_KM)[number];
  updatedWithinMin: (typeof UPDATED_WITHIN_OPTIONS_MIN)[number] | null;
  blockedFor: Vehicle | null; // only reports this vehicle can't safely pass
}

export const DEFAULT_FILTERS: MapFilters = {
  types: [],
  severities: [],
  activeOnly: false,
  nearMe: false,
  radiusKm: 3,
  updatedWithinMin: null,
  blockedFor: null,
};

// The parts the API filters on. Resolved/expired reports are never requested
// for the map, so they can't pollute the default view.
export function toListQuery(filters: MapFilters, now: Date = new Date()): Omit<ListReportsQuery, "bbox" | "limit"> {
  return {
    types: filters.types.length > 0 ? filters.types : undefined,
    severities: filters.severities.length > 0 ? filters.severities : undefined,
    statuses: filters.activeOnly ? ["active"] : ["active", "possibly_stale"],
    updatedSince:
      filters.updatedWithinMin != null
        ? new Date(now.getTime() - filters.updatedWithinMin * 60_000).toISOString()
        : undefined,
  };
}

// The parts that depend on the device (its location) or on nested fields the
// list endpoint doesn't filter by, applied to the fetched viewport. Category,
// severity and status are re-checked too so reports added locally (after a
// create/confirm) respect the active filters.
export function applyClientFilters(
  reports: Report[],
  filters: MapFilters,
  userLocation: { latitude: number; longitude: number } | null,
  now: Date = new Date(),
): Report[] {
  return reports.filter((r) => {
    if (filters.types.length > 0 && !filters.types.includes(r.type)) return false;
    if (filters.severities.length > 0 && !filters.severities.includes(r.severity)) return false;
    const status = currentStatus(r, now);
    if (!isOpen(status) || (filters.activeOnly && status !== "active")) return false;
    if (filters.nearMe && userLocation && distanceMeters(userLocation, r) > filters.radiusKm * 1000) return false;
    if (filters.blockedFor) {
      const level = r.passability?.[filters.blockedFor];
      if (level !== "not_recommended" && level !== "impassable") return false;
    }
    return true;
  });
}

export function toggleChipTypes(current: ReportType[], chipTypes: ReportType[]): ReportType[] {
  const allOn = chipTypes.every((t) => current.includes(t));
  return allOn ? current.filter((t) => !chipTypes.includes(t)) : [...new Set([...current, ...chipTypes])];
}

export function countAdvancedFilters(filters: MapFilters): number {
  let n = 0;
  if (filters.severities.length > 0 && !isSevereOnly(filters)) n++;
  if (filters.updatedWithinMin != null && filters.updatedWithinMin !== 60) n++;
  if (filters.blockedFor) n++;
  if (filters.nearMe && filters.radiusKm !== DEFAULT_FILTERS.radiusKm) n++;
  return n;
}

export function isSevereOnly(filters: MapFilters): boolean {
  return filters.severities.length === SEVERE.length && SEVERE.every((s) => filters.severities.includes(s));
}
