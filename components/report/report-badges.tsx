"use client";

import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import {
  CATEGORY_META,
  SEVERITY_META,
  STATUS_META,
  WATER_DEPTH_META,
  categoryLabel,
  severityLabel,
  statusLabel,
  toneClass,
  waterDepthLabel,
} from "@/lib/report-meta";
import type { ReportStatus, ReportType, Severity, WaterDepth } from "@/types/report";

const badgeBase = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold leading-5 whitespace-nowrap";

// Round category icon in the category's marker color — the same visual as
// the map marker, so list items and markers read as the same thing.
export function CategoryIcon({ type, size = "md", className }: { type: ReportType; size?: "sm" | "md" | "lg"; className?: string }) {
  const meta = CATEGORY_META[type];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-white",
        size === "sm" && "size-7 [&_svg]:size-4",
        size === "md" && "size-10 [&_svg]:size-5",
        size === "lg" && "size-12 [&_svg]:size-6",
        className,
      )}
      style={{ backgroundColor: meta.color }}
      aria-hidden
    >
      <Icon />
    </span>
  );
}

export function CategoryBadge({ type, className }: { type: ReportType; className?: string }) {
  const { t } = useTranslation();
  const meta = CATEGORY_META[type];
  const Icon = meta.icon;
  return (
    <span className={cn(badgeBase, "border-transparent text-white", className)} style={{ backgroundColor: meta.color }}>
      <Icon className="size-3.5" aria-hidden />
      {categoryLabel(t, type)}
    </span>
  );
}

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const { t } = useTranslation();
  const meta = SEVERITY_META[severity];
  const Icon = meta.icon;
  return (
    <span className={cn(badgeBase, toneClass(meta.tone), className)}>
      <Icon className="size-3.5" aria-hidden />
      {severityLabel(t, severity)}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: ReportStatus; className?: string }) {
  const { t } = useTranslation();
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={cn(badgeBase, toneClass(meta.tone), className)}>
      <Icon className="size-3.5" aria-hidden />
      {statusLabel(t, status)}
    </span>
  );
}

// Four-step bar showing how deep the water is relative to a person.
export function DepthGauge({ depth, className }: { depth: WaterDepth; className?: string }) {
  const level = WATER_DEPTH_META[depth].level;
  return (
    <span className={cn("inline-flex h-4 items-end gap-0.5", className)} aria-hidden>
      {[1, 2, 3, 4].map((step) => (
        <span
          key={step}
          className={cn("w-1.5 rounded-sm", step <= level ? "bg-sky-600" : "bg-slate-200")}
          style={{ height: `${25 * step}%` }}
        />
      ))}
    </span>
  );
}

export function WaterDepthBadge({ depth, className }: { depth: WaterDepth; className?: string }) {
  const { t } = useTranslation();
  const range = WATER_DEPTH_META[depth].rangeKey;
  return (
    <span className={cn(badgeBase, "border-sky-200 bg-sky-50 text-sky-900", className)}>
      <DepthGauge depth={depth} />
      {t("waterDepthLabel")}: {waterDepthLabel(t, depth)}
      {range && <span className="font-normal text-sky-800">({t(range)})</span>}
    </span>
  );
}
