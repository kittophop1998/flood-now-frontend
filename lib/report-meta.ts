import {
  Ban,
  Bike,
  CalendarDays,
  Car,
  CarFront,
  CircleCheck,
  CircleDot,
  CircleHelp,
  CircleX,
  Clock,
  Construction,
  Footprints,
  HandHeart,
  House,
  Info,
  LightbulbOff,
  MapPin,
  OctagonAlert,
  Road,
  Siren,
  TrafficCone,
  TriangleAlert,
  Truck,
  Waves,
  ZapOff,
  type LucideIcon,
} from "lucide-react";
import { EVENT_COLOR } from "@/lib/community-meta";
import type { AuthReason } from "@/lib/auth-gate";
import type { TranslateFn, TranslationKey } from "@/lib/i18n/locale";
import type {
  PassLevel,
  Passability,
  Report,
  ReportDetails,
  ReportStatus,
  ReportType,
  Severity,
  Vehicle,
  WaterDepth,
} from "@/types/report";
import { CREATABLE_REPORT_TYPES, VEHICLES, type CreatableReportType } from "@/types/report";

// Which optional field groups a category shows in the form and detail view.
// Mirrors the server's normalization (apps/api/internal/domain/report):
// water depth only for floods, passability only for road incidents; the
// category-specific details are in CATEGORY_DETAILS.
export interface CategoryFields {
  waterDepth: boolean;
  passability: boolean;
  helpDetails: boolean;
}

export interface CategoryMeta {
  icon: LucideIcon;
  // Marker fill; always paired with the icon so color is never the only cue.
  color: string;
  fields: CategoryFields;
  // A place people go to (shelter, aid point) rather than something
  // happening; never counted as a nearby "incident".
  facility?: boolean;
  // A safety-critical hazard someone who isn't signed in may report.
  // Mirrors guestReportable in apps/api/internal/domain/report/report.go
  // (the server enforces it); read through lib/auth-gate.ts.
  guestReportable?: boolean;
}

const ROAD: CategoryFields = { waterDepth: false, passability: true, helpDetails: false };
const PLAIN: CategoryFields = { waterDepth: false, passability: false, helpDetails: false };

export const CATEGORY_META: Record<ReportType, CategoryMeta> = {
  flooded: { icon: Waves, color: "#0369a1", fields: { ...ROAD, waterDepth: true }, guestReportable: true },
  road_closed: { icon: Ban, color: "#be123c", fields: ROAD, guestReportable: true },
  accident: { icon: TriangleAlert, color: "#c2410c", fields: ROAD, guestReportable: true },
  vehicle_stalled: { icon: CarFront, color: "#475569", fields: ROAD },
  obstruction: { icon: Construction, color: "#a16207", fields: ROAD, guestReportable: true },
  road_damage: { icon: Road, color: "#78350f", fields: ROAD, guestReportable: true },
  construction: { icon: TrafficCone, color: "#ea580c", fields: ROAD },
  traffic_signal_issue: { icon: LightbulbOff, color: "#0e7490", fields: PLAIN, guestReportable: true },
  power_outage: { icon: ZapOff, color: "#6d28d9", fields: PLAIN, guestReportable: true },
  help_needed: { icon: Siren, color: "#dc2626", fields: { ...PLAIN, helpDetails: true } },
  shelter: { icon: House, color: "#0f766e", fields: PLAIN, facility: true },
  aid_point: { icon: HandHeart, color: "#15803d", fields: PLAIN, facility: true },
  other: { icon: MapPin, color: "#64748b", fields: PLAIN },
};

// What the create-report category grid offers, in order. Most tiles are
// report categories (the ordinary report form); a "flow" tile starts a
// different creation form inside the same drawer (community events — public
// content, not incidents, so never a report type). A tile a guest can't use
// shows a lock and asks to sign in first (`authReason` is the explanation);
// the server enforces the same rule (report create / POST /events).
export type FlowCategory = "community_event";
export type PickerTile = {
  icon: LucideIcon;
  color: string;
  guestReportable: boolean;
  authReason: AuthReason;
  // Occupies a full row of the grid (keeps the report tiles' rows even).
  fullRow?: boolean;
} & ({ kind: "report"; type: CreatableReportType } | { kind: "flow"; type: FlowCategory });

export const FLOW_TILES: PickerTile[] = [
  { kind: "flow", type: "community_event", icon: CalendarDays, color: EVENT_COLOR, guestReportable: false, authReason: "createEvent", fullRow: true },
];

export const REPORT_PICKER_TILES: readonly PickerTile[] = [
  ...CREATABLE_REPORT_TYPES.map(
    (type): PickerTile => ({
      kind: "report",
      type,
      icon: CATEGORY_META[type].icon,
      color: CATEGORY_META[type].color,
      guestReportable: CATEGORY_META[type].guestReportable === true,
      authReason: "reportCategory",
    }),
  ),
  ...FLOW_TILES,
];

// Category-specific details (docs/api-spec.md "Category details"), in the
// order the form asks and the detail sheet shows them. Mirrors detailRules in
// apps/api/internal/domain/report/details.go. All optional. The first entry
// is a category's headline detail (see keyDetail).
export interface DetailField {
  key: string;
  options: readonly string[];
}
const LANES = ["none", "one", "multiple", "all"] as const;
export const CATEGORY_DETAILS: Partial<Record<ReportType, readonly DetailField[]>> = {
  accident: [
    { key: "lanes_blocked", options: LANES },
    { key: "traffic_impact", options: ["light", "slow", "standstill"] },
  ],
  road_closed: [
    { key: "closure", options: ["full", "partial"] },
    { key: "direction", options: ["both", "one_way"] },
  ],
  obstruction: [{ key: "obstruction_type", options: ["fallen_tree", "debris", "landslide", "fallen_object", "other"] }],
  road_damage: [{ key: "damage_type", options: ["pothole", "subsidence", "surface_damage", "other"] }],
  construction: [{ key: "lanes_blocked", options: LANES }],
  traffic_signal_issue: [{ key: "signal_issue", options: ["not_working", "flashing", "malfunction"] }],
};

export function detailFields(type: ReportType): readonly DetailField[] {
  return CATEGORY_DETAILS[type] ?? [];
}

export function detailLabel(t: TranslateFn, key: string): string {
  return t(`detail.${key}` as TranslationKey);
}

export function detailValueLabel(t: TranslateFn, key: string, value: string): string {
  return t(`detailValue.${key}.${value}` as TranslationKey);
}

// Only the details this category has, with values it allows — anything else
// (a stale draft, an unknown value from a newer API) is ignored.
export function knownDetails(type: ReportType, details: ReportDetails | null | undefined): [DetailField, string][] {
  if (!details) return [];
  return detailFields(type).flatMap((f) => {
    const v = details[f.key];
    return v && f.options.includes(v) ? [[f, v] as [DetailField, string]] : [];
  });
}

// The one detail that matters most for a category, as a short phrase
// ("Knee-deep", "1 lane blocked", "Full closure") — or null.
export function keyDetail(t: TranslateFn, report: Pick<Report, "type" | "water_depth" | "details">): string | null {
  if (report.type === "flooded") {
    return report.water_depth && report.water_depth !== "unknown" ? waterDepthLabel(t, report.water_depth) : null;
  }
  const first = knownDetails(report.type, report.details)[0];
  return first ? detailValueLabel(t, first[0].key, first[1]) : null;
}

// Whether a category affects getting around (road incidents and broken
// traffic signals) — used to rank nearby incidents; mirrors the route rules.
export function impactsTravel(type: ReportType): boolean {
  return CATEGORY_META[type].fields.passability || type === "traffic_signal_issue";
}

export function categoryLabel(t: TranslateFn, type: ReportType | FlowCategory): string {
  return t(`category.${type}`);
}

// Severity tone classes share one scale with passability and status so the
// same meaning always looks the same: teal = fine, amber = careful,
// orange = avoid, red = danger.
const TONE = {
  ok: "bg-teal-50 text-teal-800 border-teal-200",
  info: "bg-sky-50 text-sky-800 border-sky-200",
  warn: "bg-amber-50 text-amber-900 border-amber-200",
  avoid: "bg-orange-50 text-orange-900 border-orange-200",
  danger: "bg-red-50 text-red-800 border-red-200",
  muted: "bg-slate-100 text-slate-700 border-slate-200",
} as const;
export type Tone = keyof typeof TONE;
export function toneClass(tone: Tone): string {
  return TONE[tone];
}

export const SEVERITY_META: Record<Severity, { icon: LucideIcon; tone: Tone; rank: number }> = {
  low: { icon: Info, tone: "info", rank: 1 },
  moderate: { icon: TriangleAlert, tone: "warn", rank: 2 },
  high: { icon: OctagonAlert, tone: "avoid", rank: 3 },
  critical: { icon: Siren, tone: "danger", rank: 4 },
};

export function severityLabel(t: TranslateFn, severity: Severity): string {
  return t(`severity.${severity}`);
}

export const WATER_DEPTH_META: Record<WaterDepth, { level: number; rangeKey: TranslationKey | null }> = {
  unknown: { level: 0, rangeKey: null },
  ankle: { level: 1, rangeKey: "depthRange.ankle" },
  shin: { level: 2, rangeKey: "depthRange.shin" },
  knee: { level: 3, rangeKey: "depthRange.knee" },
  above_knee: { level: 4, rangeKey: "depthRange.above_knee" },
};

export function waterDepthLabel(t: TranslateFn, depth: WaterDepth): string {
  return t(`depth.${depth}`);
}

export const PASS_LEVEL_META: Record<PassLevel, { icon: LucideIcon; tone: Tone }> = {
  passable: { icon: CircleCheck, tone: "ok" },
  caution: { icon: TriangleAlert, tone: "warn" },
  not_recommended: { icon: OctagonAlert, tone: "avoid" },
  impassable: { icon: CircleX, tone: "danger" },
  unknown: { icon: CircleHelp, tone: "muted" },
};

export const VEHICLE_ICON: Record<Vehicle, LucideIcon> = {
  walk: Footprints,
  motorcycle: Bike,
  sedan: Car,
  suv_pickup: Truck,
};

export function vehicleLabel(t: TranslateFn, vehicle: Vehicle): string {
  return t(`vehicle.${vehicle}`);
}

export function passLevelLabel(t: TranslateFn, level: PassLevel): string {
  return t(`pass.${level}`);
}

export function hasKnownPassability(p: Passability | null): p is Passability {
  return p != null && VEHICLES.some((v) => p[v] !== "unknown");
}

// Suggested passability for a water depth, used to pre-fill the form so a
// reporter only has to adjust it. It's a starting point the user can change,
// not a rule the API enforces.
export function suggestPassability(depth: WaterDepth): Passability | null {
  switch (depth) {
    case "ankle":
      return { walk: "passable", motorcycle: "passable", sedan: "passable", suv_pickup: "passable" };
    case "shin":
      return { walk: "caution", motorcycle: "caution", sedan: "caution", suv_pickup: "passable" };
    case "knee":
      return { walk: "not_recommended", motorcycle: "impassable", sedan: "not_recommended", suv_pickup: "caution" };
    case "above_knee":
      return { walk: "impassable", motorcycle: "impassable", sedan: "impassable", suv_pickup: "not_recommended" };
    default:
      return null;
  }
}

export const STATUS_META: Record<ReportStatus, { icon: LucideIcon; tone: Tone }> = {
  active: { icon: CircleDot, tone: "info" },
  possibly_stale: { icon: Clock, tone: "warn" },
  resolved: { icon: CircleCheck, tone: "ok" },
  expired: { icon: Clock, tone: "muted" },
};

export function statusLabel(t: TranslateFn, status: ReportStatus): string {
  return t(`status.${status}`);
}

// Short headline answering "what's happening": the category plus the one
// detail that matters most for it.
export function reportTitle(t: TranslateFn, report: Pick<Report, "type" | "water_depth" | "people_count" | "details">): string {
  const label = categoryLabel(t, report.type);
  const detail = keyDetail(t, report);
  if (detail) return `${label} · ${detail}`;
  if (report.type === "help_needed" && report.people_count) {
    return `${label} · ${t(report.people_count === 1 ? "personCountOne" : "personCountOther", { n: report.people_count })}`;
  }
  return label;
}

export function severityRank(severity: Severity): number {
  return SEVERITY_META[severity].rank;
}
