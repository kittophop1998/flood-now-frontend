import type { ReportType, Severity } from "@/types/report";
import {
  Droplets,
  Construction,
  CarFront,
  Siren,
} from "lucide-react";

export const REPORT_TYPE_META: Record<
  ReportType,
  { label: string; icon: typeof Droplets; color: string; markerColor: string }
> = {
  flooded: {
    label: "Flooded",
    icon: Droplets,
    color: "text-sky-700",
    markerColor: "#0369a1",
  },
  road_blocked: {
    label: "Road blocked",
    icon: Construction,
    color: "text-amber-700",
    markerColor: "#b45309",
  },
  vehicle_stalled: {
    label: "Vehicle stalled",
    icon: CarFront,
    color: "text-slate-700",
    markerColor: "#334155",
  },
  help_needed: {
    label: "Help needed",
    icon: Siren,
    color: "text-red-700",
    markerColor: "#dc2626",
  },
};

export const SEVERITY_META: Record<
  Severity,
  { label: string; badgeClass: string }
> = {
  passable: {
    label: "Passable",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  caution: {
    label: "Caution",
    badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  small_vehicle_not_recommended: {
    label: "Small vehicles: avoid",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
  },
  impassable: {
    label: "Impassable",
    badgeClass: "bg-red-100 text-red-800 border-red-300",
  },
};
