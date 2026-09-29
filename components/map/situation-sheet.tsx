"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, ChevronUp, CircleAlert, Info, LocateFixed, MapPinned, Navigation2, ShieldCheck, WifiOff, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryIcon, SeverityBadge, StatusBadge } from "@/components/report/report-badges";
import { formatDistance } from "@/lib/distance";
import { formatFreshness, freshnessLine } from "@/lib/freshness";
import { categoryLabel, keyDetail, severityRank } from "@/lib/report-meta";
import { currentStatus } from "@/lib/report-status";
import { SITUATION_RADIUS_M, type Situation } from "@/lib/situation";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { Report } from "@/types/report";

// How many incidents besides the top one the sheet lists before "See all".
const MORE_ROWS = 2;

// Phones: a sheet docked above the bottom nav. Wider screens: a card floating
// at the bottom center of the map (the corners hold the SOS and map buttons).
const shell =
  "pointer-events-auto absolute inset-x-0 bottom-(--nav-h) z-20 rounded-t-3xl border-t bg-background shadow-[0_-8px_24px_-12px_rgb(15_23_42/0.25)] sm:inset-x-auto sm:bottom-[calc(var(--nav-h)+0.75rem)] sm:left-1/2 sm:w-[26rem] sm:-translate-x-1/2 sm:rounded-3xl sm:border";

// Swipe down on the handle to minimize, up to expand; a tap toggles.
function useSwipeToggle(expanded: boolean, onToggle: (expanded: boolean) => void) {
  const start = useRef<number | null>(null);
  return {
    onPointerDown: (e: ReactPointerEvent) => {
      start.current = e.clientY;
    },
    onPointerUp: (e: ReactPointerEvent) => {
      if (start.current == null) return;
      const dy = e.clientY - start.current;
      start.current = null;
      if (dy > 24 && expanded) onToggle(false);
      else if (dy < -24 && !expanded) onToggle(true);
    },
  };
}

// "สถานการณ์ใกล้คุณ": the home screen's answer to "what's happening around
// me, how far, is it still going on". Never a modal — the map stays usable.
export function SituationSheet({
  situation,
  status,
  fetchedAt,
  aroundUser,
  expanded,
  onExpandedChange,
  online,
  now,
  onRetry,
  onShowOnMap,
  onOpenReport,
  onSeeAll,
  onLookElsewhere,
  onUseLocation,
  sheetRef,
}: {
  situation: Situation;
  status: "idle" | "loading" | "ready" | "error";
  fetchedAt: string | null;
  // true: around the device; false: around the map center.
  aroundUser: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  online: boolean;
  now: Date;
  onRetry: () => void;
  onShowOnMap: (report: Report) => void;
  onOpenReport: (report: Report) => void;
  onSeeAll: () => void;
  onLookElsewhere: () => void;
  // Offered while showing the map center (location off but not blocked).
  onUseLocation?: () => void;
  sheetRef: (el: HTMLElement | null) => void;
}) {
  const { t } = useTranslation();
  const swipe = useSwipeToggle(expanded, onExpandedChange);
  const radius = formatDistance(SITUATION_RADIUS_M, t);
  const { incidents, top } = situation;
  const count = incidents.length;
  // Severe (high/critical) incidents are called out in the one-line summary,
  // so the minimized sheet already says whether anything nearby is dangerous.
  const severe = incidents.filter((r) => severityRank(r.severity) >= 3).length;
  const title = aroundUser ? t("situationTitle") : t("situationTitleMap");
  const ready = status === "ready";
  const summary = !ready
    ? status === "error"
      ? online
        ? t("situationFailed")
        : t("situationOffline")
      : t("situationChecking")
    : count === 0
      ? t(aroundUser ? "situationClear" : "situationClearMap", { d: radius })
      : t(count === 1 ? "situationCountOne" : "situationCount", { n: count, d: radius }) + (severe > 0 ? ` · ${t("situationSevere", { n: severe })}` : "");

  return (
    <section ref={sheetRef} aria-label={title} className={shell}>
      <button
        type="button"
        {...swipe}
        onClick={() => onExpandedChange(!expanded)}
        aria-expanded={expanded}
        aria-label={expanded ? t("situationCollapse") : t("situationExpand")}
        className="flex w-full touch-none flex-col items-center gap-2 rounded-t-3xl px-4 pt-2 pb-2.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <span className="h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
        <span className="flex w-full items-center gap-3">
          {ready && top ? (
            <CategoryIcon type={top.type} size="sm" />
          ) : (
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full [&_svg]:size-4",
                ready ? "bg-teal-50 text-teal-700" : status === "error" ? "bg-amber-50 text-amber-800" : "bg-muted text-muted-foreground",
              )}
              aria-hidden
            >
              {ready ? <ShieldCheck /> : status === "error" ? online ? <CircleAlert /> : <WifiOff /> : <Navigation2 className="animate-pulse" />}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{title}</span>
            <span className="block truncate text-xs text-muted-foreground" aria-live="polite">
              {summary}
            </span>
          </span>
          {expanded ? <ChevronDown className="size-5 shrink-0 text-muted-foreground" aria-hidden /> : <ChevronUp className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
        </span>
      </button>

      {expanded && (
        <div className="flex max-h-[40dvh] flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-3">
          {status === "error" && (
            <Button variant="outline" className="h-11 rounded-xl" onClick={onRetry}>
              {t("retry")}
            </Button>
          )}

          {ready && top && <TopIncident report={top} now={now} onShowOnMap={() => onShowOnMap(top)} onOpen={() => onOpenReport(top)} />}

          {ready && incidents.length > 1 && (
            <ul className="-mx-1 flex flex-col">
              {incidents.slice(1, 1 + MORE_ROWS).map((r) => (
                <li key={r.id}>
                  <IncidentRow report={r} now={now} onOpen={() => onOpenReport(r)} />
                </li>
              ))}
            </ul>
          )}
          {ready && incidents.length > 1 + MORE_ROWS && (
            <Button variant="ghost" className="h-11 self-start rounded-xl px-2 text-primary" onClick={onSeeAll}>
              {t("situationSeeAll")} ({count})
            </Button>
          )}

          {ready && count === 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              {fetchedAt && <p className="text-xs text-muted-foreground">{t("situationCheckedAt", { ago: formatFreshness(fetchedAt, t, now) })}</p>}
              <Button variant="outline" className="h-11 rounded-xl" onClick={onLookElsewhere}>
                <ZoomOut aria-hidden />
                {t("situationLookElsewhere")}
              </Button>
            </div>
          )}

          {onUseLocation && (
            <Button variant="ghost" className="h-11 self-start rounded-xl px-2 text-primary" onClick={onUseLocation}>
              <LocateFixed aria-hidden />
              {t("useMyLocation")}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function TopIncident({ report, now, onShowOnMap, onOpen }: { report: Report; now: Date; onShowOnMap: () => void; onOpen: () => void }) {
  const { t } = useTranslation();
  const status = currentStatus(report, now);
  const detail = keyDetail(t, report);
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-muted/60 p-3">
      <div className="flex items-start gap-3">
        <CategoryIcon type={report.type} size="md" className={cn(status === "possibly_stale" && "saturate-50")} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="flex items-baseline justify-between gap-2">
            <span className="truncate font-semibold">{categoryLabel(t, report.type)}</span>
            {report.distance_m != null && <span className="shrink-0 text-sm font-semibold tabular-nums">{formatDistance(report.distance_m, t)}</span>}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <SeverityBadge severity={report.severity} />
            {status !== "active" && <StatusBadge status={status} />}
          </div>
          <p className="text-xs text-muted-foreground">
            {detail ? `${detail} · ` : ""}
            {freshnessLine(report, t, now)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11 rounded-xl bg-background" onClick={onShowOnMap}>
          <MapPinned aria-hidden />
          {t("situationShowOnMap")}
        </Button>
        <Button className="h-11 rounded-xl" onClick={onOpen}>
          <Info aria-hidden />
          {t("situationDetails")}
        </Button>
      </div>
    </div>
  );
}

function IncidentRow({ report, now, onOpen }: { report: Report; now: Date; onOpen: () => void }) {
  const { t } = useTranslation();
  const status = currentStatus(report, now);
  const detail = keyDetail(t, report);
  const lead = status === "possibly_stale" ? t("status.possibly_stale") : detail;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex min-h-12 w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
        status !== "active" && "opacity-75",
      )}
    >
      <CategoryIcon type={report.type} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{categoryLabel(t, report.type)}</span>
          <SeverityBadge severity={report.severity} className="px-1.5 py-0 text-[11px] leading-4 [&_svg]:size-3" />
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {lead ? `${lead} · ` : ""}
          {freshnessLine(report, t, now)}
        </span>
      </span>
      {report.distance_m != null && <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{formatDistance(report.distance_m, t)}</span>}
    </button>
  );
}

// One-time intro (first launch, no location yet): one line of what FloodNow
// is for and two ways in. Never shown again once dismissed or located.
export function SituationIntro({
  locating,
  onUseLocation,
  onPickArea,
  sheetRef,
}: {
  locating: boolean;
  onUseLocation: () => void;
  onPickArea: () => void;
  sheetRef: (el: HTMLElement | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <section ref={sheetRef} aria-labelledby="intro-title" className={cn(shell, "flex flex-col gap-3 px-4 pt-4 pb-4")}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary" aria-hidden>
          <Navigation2 className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="intro-title" className="font-semibold">
            {t("introTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("introBody")}</p>
        </div>
      </div>
      <div className="grid gap-2 min-[400px]:grid-cols-2">
        <Button className="h-12 rounded-xl text-base" onClick={onUseLocation} disabled={locating}>
          <LocateFixed className={locating ? "animate-pulse" : undefined} aria-hidden />
          {t("useMyLocation")}
        </Button>
        <Button variant="outline" className="h-12 rounded-xl text-base" onClick={onPickArea}>
          <MapPinned aria-hidden />
          {t("introPickArea")}
        </Button>
      </div>
    </section>
  );
}
