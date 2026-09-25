import type { ReportType, Severity } from "@/types/report";
import type { TranslateFn } from "@/lib/i18n/locale";
import {
  Droplets,
  Construction,
  CarFront,
  Siren,
  CircleCheck,
  TriangleAlert,
  OctagonAlert,
  Ban,
} from "lucide-react";

export const REPORT_TYPE_META: Record<
  ReportType,
  { icon: typeof Droplets; color: string; markerColor: string }
> = {
  flooded: {
    icon: Droplets,
    color: "text-sky-700",
    markerColor: "#0369a1",
  },
  road_blocked: {
    icon: Construction,
    color: "text-amber-700",
    markerColor: "#b45309",
  },
  vehicle_stalled: {
    icon: CarFront,
    color: "text-slate-700",
    markerColor: "#334155",
  },
  help_needed: {
    icon: Siren,
    color: "text-red-700",
    markerColor: "#dc2626",
  },
};

// Each severity carries an icon as well as a color so passability never
// relies on color alone.
export const SEVERITY_META: Record<Severity, { badgeClass: string; icon: typeof Droplets; iconClass: string; textClass: string }> = {
  passable: {
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: CircleCheck,
    iconClass: "bg-emerald-100 text-emerald-700",
    textClass: "text-emerald-800",
  },
  caution: {
    badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-300",
    icon: TriangleAlert,
    iconClass: "bg-yellow-100 text-yellow-700",
    textClass: "text-yellow-800",
  },
  small_vehicle_not_recommended: {
    badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
    icon: OctagonAlert,
    iconClass: "bg-orange-100 text-orange-700",
    textClass: "text-orange-800",
  },
  impassable: {
    badgeClass: "bg-red-100 text-red-800 border-red-300",
    icon: Ban,
    iconClass: "bg-red-100 text-red-700",
    textClass: "text-red-800",
  },
};

export function reportTypeLabel(t: TranslateFn, type: ReportType): string {
  return t(`reportType.${type}`);
}

export function severityLabel(t: TranslateFn, severity: Severity): string {
  return t(`severity.${severity}`);
}

// Full-sentence form of severity ("small vehicles not recommended"), used as
// the headline of the report detail modal.
export function passabilityLabel(t: TranslateFn, severity: Severity): string {
  return t(`passability.${severity}`);
}
