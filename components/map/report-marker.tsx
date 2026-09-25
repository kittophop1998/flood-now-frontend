"use client";

import { memo } from "react";
import { CATEGORY_META, SEVERITY_META, reportTitle, severityLabel, severityRank } from "@/lib/report-meta";
import { currentStatus } from "@/lib/report-status";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { Report } from "@/types/report";

// Severity shows as the ring weight + a small corner badge (icon, not just
// color), so the map stays readable without a legend. Possibly-stale
// reports are faded and dashed; help requests pulse as an urgency signal
// (never implying official dispatch — see docs/product-spec.md).
export const ReportMarker = memo(function ReportMarker({
  report,
  selected,
  now,
  dimmed,
}: {
  report: Report;
  selected: boolean;
  now: Date;
  dimmed?: boolean;
}) {
  const { t } = useTranslation();
  const meta = CATEGORY_META[report.type];
  const Icon = meta.icon;
  const sev = SEVERITY_META[report.severity];
  const SevIcon = sev.icon;
  const stale = currentStatus(report, now) === "possibly_stale";
  const rank = severityRank(report.severity);

  return (
    <button
      type="button"
      aria-label={t("reportAriaLabel", { title: reportTitle(t, report), severity: severityLabel(t, report.severity) })}
      aria-pressed={selected}
      tabIndex={dimmed ? -1 : 0}
      className={cn(
        "group relative flex size-11 items-center justify-center rounded-full outline-none",
        dimmed && "pointer-events-none opacity-40",
      )}
    >
      {report.type === "help_needed" && !stale && !dimmed && (
        <span className="absolute inline-flex size-9 animate-ping rounded-full opacity-50" style={{ backgroundColor: meta.color }} />
      )}
      <span
        className={cn(
          "relative flex items-center justify-center rounded-full border-white shadow-md transition-transform duration-200",
          rank >= 3 ? "size-9 border-[3px]" : "size-8 border-2",
          stale && "border-dashed opacity-60 saturate-50",
          selected && "size-11 scale-110 shadow-xl ring-4 ring-primary/35",
          "group-focus-visible:ring-4 group-focus-visible:ring-ring",
        )}
        style={{ backgroundColor: meta.color }}
      >
        <Icon className={cn("text-white", selected ? "size-6" : "size-[18px]")} aria-hidden />
      </span>
      {rank >= 3 && (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 flex size-[18px] items-center justify-center rounded-full border-2 border-white text-white shadow",
            rank === 4 ? "bg-red-600" : "bg-orange-500",
          )}
          aria-hidden
        >
          <SevIcon className="size-2.5" />
        </span>
      )}
    </button>
  );
});

export const ClusterMarker = memo(function ClusterMarker({
  count,
  worstRank,
  label,
  dimmed,
}: {
  count: number;
  worstRank: number;
  label: string;
  dimmed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      tabIndex={dimmed ? -1 : 0}
      className={cn("group flex size-12 items-center justify-center rounded-full outline-none", dimmed && "pointer-events-none opacity-40")}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full border-[3px] bg-primary font-semibold text-primary-foreground shadow-lg tabular-nums group-focus-visible:ring-4 group-focus-visible:ring-ring",
          count >= 100 ? "size-12 text-sm" : count >= 10 ? "size-11 text-sm" : "size-10 text-sm",
          worstRank === 4 ? "border-red-500" : worstRank === 3 ? "border-orange-400" : "border-white",
        )}
      >
        {count}
      </span>
    </button>
  );
});
