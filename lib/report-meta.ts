import type { ReportType, Severity } from "@/types/report";
import type { TranslateFn } from "@/lib/i18n/locale";
import {
  Droplets,
  Construction,
  CarFront,
  Siren,
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

export const SEVERITY_META: Record<Severity, { badgeClass: string }> = {
  passable: {
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  caution: {
    badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  small_vehicle_not_recommended: {
    badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
  },
  impassable: {
    badgeClass: "bg-red-100 text-red-800 border-red-300",
  },
};

export function reportTypeLabel(t: TranslateFn, type: ReportType): string {
  return t(`reportType.${type}`);
}

export function severityLabel(t: TranslateFn, severity: Severity): string {
  return t(`severity.${severity}`);
}
