"use client";

import { memo } from "react";
import { Clock } from "lucide-react";
import { CATEGORY_META, SEVERITY_META, reportTitle, severityLabel, severityRank } from "@/lib/report-meta";
import { currentStatus } from "@/lib/report-status";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { Report } from "@/types/report";

// Severity shows as the ring weight + a small corner badge (icon, not just
// color), so the map stays readable without a legend. Every report that
// isn't active (past stale_at, expired or resolved) stays on the map but is
// faded and dashed; help requests pulse as an urgency signal
// (never implying official dispatch — see docs/product-spec.md).
// Reports updated within RECENT_WINDOW_MIN get a halo + clock badge and full
// size; older ones shrink so the fresh picture stands out. Pins are never
// grouped: zoomed out (`compact`) each one is a small dot instead.
export const ReportMarker = memo(function ReportMarker({
  report,
  selected,
  now,
  dimmed,
  recent,
  compact,
}: {
  report: Report;
  selected: boolean;
  now: Date;
  dimmed?: boolean;
  recent: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const meta = CATEGORY_META[report.type];
  const Icon = meta.icon;
  const sev = SEVERITY_META[report.severity];
  const SevIcon = sev.icon;
  const stale = currentStatus(report, now) !== "active";
  const rank = severityRank(report.severity);
  const title = reportTitle(t, report);
  const severity = severityLabel(t, report.severity);

  if (compact && !selected) {
    return (
      <button
        type="button"
        aria-label={t(recent ? "reportRecentAriaLabel" : "reportAriaLabel", { title, severity })}
        tabIndex={dimmed ? -1 : 0}
        className={cn(
          "group relative flex size-7 items-center justify-center rounded-full outline-none",
          dimmed && "pointer-events-none opacity-40",
        )}
      >
        <span
          className={cn(
            "flex items-center justify-center rounded-full border-2 border-white shadow group-focus-visible:ring-4 group-focus-visible:ring-ring",
            recent ? "size-6 ring-2 ring-sky-500/80" : rank >= 3 ? "size-4" : "size-3.5",
            stale && "border-dashed opacity-60 saturate-50",
          )}
          style={{ backgroundColor: meta.color }}
        >
          {recent && <Icon className="size-3.5 text-white" aria-hidden />}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={t(recent ? "reportRecentAriaLabel" : "reportAriaLabel", { title, severity })}
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
          !recent ? "size-7 border-2" : rank >= 3 ? "size-9 border-[3px]" : "size-8 border-2",
          recent && !selected && "ring-[3px] ring-sky-500/70",
          stale && "border-dashed opacity-60 saturate-50",
          selected && "size-11 scale-110 shadow-xl ring-4 ring-primary/35",
          "group-focus-visible:ring-4 group-focus-visible:ring-ring",
        )}
        style={{ backgroundColor: meta.color }}
      >
        <Icon className={cn("text-white", selected ? "size-6" : recent ? "size-[18px]" : "size-4")} aria-hidden />
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
      {recent && (
        <span
          className="absolute -bottom-0.5 -left-0.5 flex size-[18px] items-center justify-center rounded-full border-2 border-white bg-sky-600 text-white shadow"
          aria-hidden
        >
          <Clock className="size-2.5" />
        </span>
      )}
    </button>
  );
});
