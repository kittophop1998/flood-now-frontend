"use client";

import type { ReactNode } from "react";
import { MapPin, UsersRound } from "lucide-react";
import { CategoryIcon, SeverityBadge, StatusBadge, WaterDepthBadge } from "@/components/report/report-badges";
import { PassabilitySummary } from "@/components/report/passability";
import { formatDistance } from "@/lib/distance";
import { freshnessLine } from "@/lib/freshness";
import { imageKitUrl } from "@/lib/imagekit";
import { hasKnownPassability, reportTitle } from "@/lib/report-meta";
import { currentStatus } from "@/lib/report-status";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { Report } from "@/types/report";

// The answers people need in seconds: what (title), how bad (severity),
// still happening? (status + freshness), can I pass (passability).
export function ReportSummary({
  report,
  now,
  distanceM,
  headingId,
  headingAs: Heading = "h3",
  locationText,
}: {
  report: Report;
  now: Date;
  distanceM?: number | null;
  headingId?: string;
  headingAs?: "h2" | "h3";
  locationText?: string | null;
}) {
  const { t } = useTranslation();
  const status = currentStatus(report, now);
  const thumb = report.image_url ?? imageKitUrl(report.image_key);
  const stale = status !== "active";

  return (
    <div className={cn("flex gap-3", stale && "opacity-80")}>
      <CategoryIcon type={report.type} className={cn(status === "possibly_stale" && "saturate-50")} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Heading id={headingId} tabIndex={headingId ? -1 : undefined} className="text-base leading-snug font-semibold outline-none">
            {reportTitle(t, report)}
          </Heading>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <SeverityBadge severity={report.severity} />
          {status !== "active" && <StatusBadge status={status} />}
          {report.type === "flooded" && report.water_depth && report.water_depth !== "unknown" && (
            <WaterDepthBadge depth={report.water_depth} />
          )}
        </div>
        {hasKnownPassability(report.passability) && <PassabilitySummary passability={report.passability} />}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>{freshnessLine(report, t, now)}</span>
          {report.still_active_count > 0 && (
            <span className="inline-flex items-center gap-1">
              <UsersRound className="size-3.5" aria-hidden />
              {t("confirmationsCount", { n: report.still_active_count })}
            </span>
          )}
          {distanceM != null && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {t("distanceAway", { d: formatDistance(distanceM, t) })}
            </span>
          )}
        </p>
        {locationText && <p className="truncate text-xs text-muted-foreground">{locationText}</p>}
      </div>
      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" loading="lazy" className="size-16 shrink-0 rounded-xl bg-muted object-cover" />
      )}
    </div>
  );
}

export function ReportCard({
  report,
  now,
  distanceM,
  onSelect,
  footer,
  highlight,
}: {
  report: Report;
  now: Date;
  distanceM?: number | null;
  onSelect?: () => void;
  footer?: ReactNode;
  highlight?: boolean;
}) {
  const body = <ReportSummary report={report} now={now} distanceM={distanceM} />;
  return (
    <div className={cn("rounded-2xl border bg-card shadow-xs", highlight && "border-primary/40 ring-1 ring-primary/20")}>
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          className="w-full rounded-2xl p-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {body}
        </button>
      ) : (
        <div className="p-3.5">{body}</div>
      )}
      {footer && <div className="border-t px-3.5 py-3">{footer}</div>}
    </div>
  );
}
