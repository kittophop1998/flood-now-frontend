import {
  Ban,
  Bike,
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
  MapPin,
  OctagonAlert,
  Siren,
  TriangleAlert,
  Truck,
  Waves,
  ZapOff,
  type LucideIcon,
} from "lucide-react";
import type { TranslateFn, TranslationKey } from "@/lib/i18n/locale";
import type {
  PassLevel,
  Passability,
  Report,
  ReportStatus,
  ReportType,
  Severity,
  Vehicle,
  WaterDepth,
} from "@/types/report";
import { VEHICLES } from "@/types/report";

// Which optional field groups a category shows in the form and detail view.
// Mirrors the server's normalization (apps/api/internal/domain/report):
// water depth only for floods, passability only for road incidents.
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
}

const ROAD: CategoryFields = { waterDepth: false, passability: true, helpDetails: false };
const PLAIN: CategoryFields = { waterDepth: false, passability: false, helpDetails: false };

export const CATEGORY_META: Record<ReportType, CategoryMeta> = {
  flooded: { icon: Waves, color: "#0369a1", fields: { ...ROAD, waterDepth: true } },
  road_closed: { icon: Ban, color: "#be123c", fields: ROAD },
  accident: { icon: TriangleAlert, color: "#c2410c", fields: ROAD },
  vehicle_stalled: { icon: CarFront, color: "#475569", fields: ROAD },
  obstruction: { icon: Construction, color: "#a16207", fields: ROAD },
  power_outage: { icon: ZapOff, color: "#6d28d9", fields: PLAIN },
  help_needed: { icon: Siren, color: "#dc2626", fields: { ...PLAIN, helpDetails: true } },
  shelter: { icon: House, color: "#0f766e", fields: PLAIN },
  aid_point: { icon: HandHeart, color: "#15803d", fields: PLAIN },
  other: { icon: MapPin, color: "#64748b", fields: PLAIN },
};

export function categoryLabel(t: TranslateFn, type: ReportType): string {
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
export function reportTitle(t: TranslateFn, report: Pick<Report, "type" | "water_depth" | "people_count">): string {
  const label = categoryLabel(t, report.type);
  if (report.type === "flooded" && report.water_depth && report.water_depth !== "unknown") {
    return `${label} · ${waterDepthLabel(t, report.water_depth)}`;
  }
  if (report.type === "help_needed" && report.people_count) {
    return `${label} · ${t(report.people_count === 1 ? "personCountOne" : "personCountOther", { n: report.people_count })}`;
  }
  return label;
}

export function severityRank(severity: Severity): number {
  return SEVERITY_META[severity].rank;
}
