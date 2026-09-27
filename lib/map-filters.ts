import { distanceMeters } from "@/lib/distance";
import { currentStatus } from "@/lib/report-status";
import type { ListReportsQuery, Report, ReportStatus, ReportType, Severity, Vehicle } from "@/types/report";

// Category options in the filter sheet. Shelter and aid point share one —
// both answer "where can I get help/shelter"; the legacy categories no new
// report can use (older stored reports still have them) share one too.
export const CATEGORY_CHIPS: { id: string; types: ReportType[] }[] = [
  { id: "flooded", types: ["flooded"] },
  { id: "road_closed", types: ["road_closed"] },
  { id: "accident", types: ["accident"] },
  { id: "obstruction", types: ["obstruction"] },
  { id: "road_damage", types: ["road_damage"] },
  { id: "construction", types: ["construction"] },
  { id: "traffic_signal_issue", types: ["traffic_signal_issue"] },
  { id: "power_outage", types: ["power_outage"] },
  { id: "facilities", types: ["shelter", "aid_point"] },
  { id: "legacy", types: ["vehicle_stalled", "help_needed", "other"] },
];

export const RADIUS_OPTIONS_KM = [1, 3, 5] as const;
export const UPDATED_WITHIN_OPTIONS_MIN = [60, 120, 180, 360] as const;
// The "Latest" quick chip and the highlighted pins on the map share this window.
export const RECENT_WINDOW_MIN = 120;
export const SEVERE: Severity[] = ["high", "critical"];

export interface MapFilters {
  types: ReportType[]; // empty = all categories
  severities: Severity[]; // empty = all
  activeOnly: boolean; // hide everything that isn't "active"
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

// Every pin stays on the map: reports past their stale_at (and expired or
// resolved ones) are shown faded by the marker instead of disappearing. The
// zoomed-out zone counts use the same statuses, so they match the pins.
export const ALL_STATUSES: ReportStatus[] = ["active", "possibly_stale", "expired", "resolved"];

// The parts the API filters on.
export function toListQuery(filters: MapFilters, now: Date = new Date()): Omit<ListReportsQuery, "bbox" | "limit"> {
  return {
    types: filters.types.length > 0 ? filters.types : undefined,
    severities: filters.severities.length > 0 ? filters.severities : undefined,
    statuses: filters.activeOnly ? ["active"] : ALL_STATUSES,
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
    if (filters.activeOnly && currentStatus(r, now) !== "active") return false;
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

// Filters set in the sheet beyond the two quick toggles on the map (near me,
// ongoing) — shown as a count on the filter button so nothing is hidden.
export function countAdvancedFilters(filters: MapFilters): number {
  let n = 0;
  if (filters.types.length > 0) n++;
  if (filters.severities.length > 0) n++;
  if (filters.updatedWithinMin != null) n++;
  if (filters.blockedFor) n++;
  if (filters.nearMe && filters.radiusKm !== DEFAULT_FILTERS.radiusKm) n++;
  return n;
}

export function isSevereOnly(filters: MapFilters): boolean {
  return filters.severities.length === SEVERE.length && SEVERE.every((s) => filters.severities.includes(s));
}

// Updated (reported or re-confirmed) within the last RECENT_WINDOW_MIN; the
// map draws these pins emphasized and above older ones.
export function isRecentlyUpdated(report: Pick<Report, "last_verified_at">, now: Date = new Date()): boolean {
  return now.getTime() - new Date(report.last_verified_at).getTime() < RECENT_WINDOW_MIN * 60_000;
}
