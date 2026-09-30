"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { ChevronDown, ChevronRight, CircleAlert, Loader2, Map as MapIcon, Navigation, Route, RouteOff, TriangleAlert, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RouteRiskBadge, ToneBadge } from "@/components/community/badges";
import type { LocationValue } from "@/components/community/location-field";
import { CategoryIcon } from "@/components/report/report-badges";
import { RouteEndpointsCard, routeEndRowId, type RouteEnd } from "@/components/route/route-endpoints-card";
import { RouteLocationSheet } from "@/components/route/route-location-sheet";
import { EmptyState, ViewShell } from "@/components/views/view-shell";
import type { useRouteEvaluation } from "@/features/route/use-route-evaluation";
import { ROUTE_IMPACT_META } from "@/lib/community-meta";
import { tripDirectionsUrl } from "@/lib/directions";
import { distanceMeters, formatDistance, formatDuration } from "@/lib/distance";
import { formatClockTime, freshnessLine } from "@/lib/freshness";
import { VEHICLE_ICON, reportTitle, vehicleLabel } from "@/lib/report-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { TranslateFn } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import type { EvaluatedRoute, LatLng, RouteEvaluation, SavedPlace } from "@/types/community";
import { VEHICLES, type Report, type Vehicle } from "@/types/report";

export interface RouteDraft {
  origin: LocationValue | null;
  destination: LocationValue | null;
  vehicle: Vehicle;
}

// Closer than this the routing provider has nothing useful to say.
const MIN_ROUTE_METERS = 20;

function incidentCountLine(route: EvaluatedRoute, t: TranslateFn): string {
  if (route.incident_count === 0) return t("routeNoReports");
  return t(route.incident_count === 1 ? "routeIncidentCountOne" : "routeIncidentCount", { n: route.incident_count });
}

// Safe route by vehicle: the routing provider proposes routes, the API
// scores them against open community reports (deterministic rules), and the
// trip itself is handed off to the device's maps app.
export function RouteView({
  draft,
  onDraftChange,
  evaluation,
  savedPlaces,
  onBack,
  hidden,
  onUseMyLocation,
  userLocation,
  onSelectReport,
  onShowOnMap,
}: {
  draft: RouteDraft;
  onDraftChange: (draft: RouteDraft) => void;
  evaluation: ReturnType<typeof useRouteEvaluation>;
  savedPlaces: SavedPlace[];
  onBack: () => void;
  hidden?: boolean;
  onUseMyLocation: () => Promise<LatLng | null>;
  userLocation: LatLng | null;
  onSelectReport: (report: Report) => void;
  onShowOnMap: (result: RouteEvaluation, index: number) => void;
}) {
  const { t, locale } = useTranslation();
  const [editing, setEditing] = useState<RouteEnd | null>(null);
  const [attempted, setAttempted] = useState(false);
  const { state } = evaluation;

  // Any change to the inputs invalidates a shown (or pending) result, so the
  // routes on screen always belong to the current start/destination/vehicle.
  function update(next: RouteDraft) {
    onDraftChange(next);
    if (state.status !== "idle") evaluation.reset();
  }

  const missing: RouteEnd[] = [];
  if (!draft.origin) missing.push("origin");
  if (!draft.destination) missing.push("destination");
  const tooClose = draft.origin != null && draft.destination != null && distanceMeters(draft.origin, draft.destination) < MIN_ROUTE_METERS;
  const loading = state.status === "loading";
  const blocked = missing.length > 0 || tooClose;

  function check() {
    if (loading) return;
    if (missing.length > 0) {
      setAttempted(true);
      document.getElementById(routeEndRowId(missing[0]))?.focus();
      return;
    }
    if (tooClose || !draft.origin || !draft.destination) return;
    setAttempted(false);
    evaluation.evaluate(draft.origin, draft.destination, draft.vehicle);
  }

  // Bring the results into view (they start below the form on phones).
  const readyResult = state.status === "ready" ? state.result : null;
  useEffect(() => {
    if (!readyResult) return;
    const heading = document.getElementById("route-results");
    heading?.scrollIntoView({ block: "start", behavior: "smooth" });
    heading?.focus({ preventScroll: true });
  }, [readyResult]);

  const errorTitle =
    state.status !== "error"
      ? null
      : state.kind === "offline"
        ? t("routeOffline")
        : state.kind === "unavailable"
          ? t("routeUnavailable")
          : state.kind === "invalid"
            ? (state.message ?? t("routeFailed"))
            : t("routeFailed");

  const helper = tooClose ? t("routeTooClose") : missing.length > 0 ? t("routeNeedsBothEnds") : null;
  const footer =
    state.status === "ready" ? undefined : (
      <>
        {helper && (
          <p id="route-cta-help" className={cn("mb-2 text-xs text-muted-foreground", tooClose && "text-destructive")}>
            {helper}
          </p>
        )}
        <Button
          className={cn("h-12 w-full rounded-xl text-base [&_svg:not([class*='size-'])]:size-5", blocked && "opacity-50")}
          onClick={check}
          disabled={loading}
          aria-busy={loading || undefined}
          aria-disabled={blocked || undefined}
          aria-describedby={helper ? "route-cta-help" : undefined}
        >
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Route aria-hidden />}
          {loading ? t("routeChecking") : t("routeCheck")}
        </Button>
      </>
    );

  return (
    <ViewShell title={t("routeTitle")} subtitle={t("routeSubtitle")} onBack={onBack} hidden={hidden} footer={footer}>
      <div className="flex flex-col gap-5">
        <RouteEndpointsCard
          origin={draft.origin}
          destination={draft.destination}
          onEdit={setEditing}
          onSwap={() => update({ ...draft, origin: draft.destination, destination: draft.origin })}
          invalidEnds={attempted ? missing : []}
        />
        <VehiclePicker value={draft.vehicle} onChange={(vehicle) => update({ ...draft, vehicle })} />

        <p className="sr-only" aria-live="polite">
          {readyResult ? t("routeResultsAnnounce", { n: readyResult.routes.length }) : (errorTitle ?? "")}
        </p>

        {errorTitle && (
          <div className="mt-1">
            <EmptyState icon={state.status === "error" && state.kind === "offline" ? <WifiOff /> : <CircleAlert />} title={errorTitle} />
          </div>
        )}

        {readyResult && draft.origin && draft.destination && (
          <RouteResults
            result={readyResult}
            origin={draft.origin}
            destination={draft.destination}
            locale={locale}
            onSelectReport={onSelectReport}
            onShowOnMap={onShowOnMap}
          />
        )}
      </div>

      {editing && (
        <RouteLocationSheet
          end={editing}
          value={draft[editing]}
          savedPlaces={savedPlaces}
          userLocation={userLocation}
          onUseMyLocation={onUseMyLocation}
          onChoose={(value) => {
            update({ ...draft, [editing]: value });
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </ViewShell>
  );
}

// One-row segmented control (radio group with arrow-key roving).
function VehiclePicker({ value, onChange }: { value: Vehicle; onChange: (v: Vehicle) => void }) {
  const { t } = useTranslation();

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = VEHICLES[(VEHICLES.indexOf(value) + step + VEHICLES.length) % VEHICLES.length];
    onChange(next);
    document.getElementById(`route-vehicle-${next}`)?.focus();
  }

  return (
    <fieldset>
      <legend id="route-vehicle-label" className="mb-2 text-sm font-medium text-muted-foreground">
        {t("routeVehicle")}
      </legend>
      <div role="radiogroup" aria-labelledby="route-vehicle-label" onKeyDown={onKeyDown} className="grid grid-cols-4 gap-1 rounded-2xl bg-card p-1">
        {VEHICLES.map((v) => {
          const Icon = VEHICLE_ICON[v];
          const selected = value === v;
          return (
            <button
              key={v}
              id={`route-vehicle-${v}`}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(v)}
              className={cn(
                "flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center text-xs leading-tight font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                selected ? "bg-accent font-semibold text-primary" : "hover:bg-muted/60",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {vehicleLabel(t, v)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function RouteResults({
  result,
  origin,
  destination,
  locale,
  onSelectReport,
  onShowOnMap,
}: {
  result: RouteEvaluation;
  origin: LatLng;
  destination: LatLng;
  locale: "th" | "en";
  onSelectReport: (report: Report) => void;
  onShowOnMap: (result: RouteEvaluation, index: number) => void;
}) {
  const { t } = useTranslation();
  // Which route is expanded; back to the first one for every new result.
  const [open, setOpen] = useState(0);
  const [openFor, setOpenFor] = useState(result);
  if (openFor !== result) {
    setOpenFor(result);
    setOpen(0);
  }
  const allBlocked = result.routes.length > 0 && result.routes.every((r) => r.risk === "blocked");

  return (
    <section aria-labelledby="route-results" className="mt-1 flex flex-col gap-3">
      <div>
        <h2 id="route-results" tabIndex={-1} className="scroll-mt-4 text-base font-semibold outline-none">
          {t("routeResultsTitle")}
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {vehicleLabel(t, result.vehicle)} · {t("routeDataAsOf", { time: formatClockTime(result.evaluated_at, locale) })}
        </p>
      </div>

      {!result.data_complete && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("routeDataIncomplete")}
        </p>
      )}

      {result.routes.length === 0 ? (
        <EmptyState icon={<RouteOff />} title={t("routeNone")} hint={t("routeNoneHint")} />
      ) : (
        <>
          {allBlocked && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-900">
              {t("routeAllBlocked")}
            </p>
          )}
          {result.routes.map((route, i) =>
            i === open ? (
              <RouteCard
                key={i}
                index={i}
                route={route}
                origin={origin}
                destination={destination}
                walking={result.vehicle === "walk"}
                onSelectReport={onSelectReport}
                onShowOnMap={() => onShowOnMap(result, i)}
              />
            ) : (
              <button
                key={i}
                type="button"
                aria-expanded={false}
                aria-controls={`route-option-${i}`}
                onClick={() => setOpen(i)}
                className="flex w-full flex-col gap-1 rounded-2xl bg-card p-4 text-left hover:bg-card/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex w-full items-center gap-2">
                  <span className="min-w-0 flex-1 font-semibold">{t("routeOption", { n: i + 1 })}</span>
                  <RouteRiskBadge risk={route.risk} />
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatDuration(route.duration_s, t)} · {formatDistance(route.distance_m, t)} · {incidentCountLine(route, t)}
                </span>
              </button>
            ),
          )}
        </>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">{t("routeDisclaimerFull")}</p>
    </section>
  );
}

function RouteCard({
  index,
  route,
  origin,
  destination,
  walking,
  onSelectReport,
  onShowOnMap,
}: {
  index: number;
  route: EvaluatedRoute;
  origin: LatLng;
  destination: LatLng;
  walking: boolean;
  onSelectReport: (report: Report) => void;
  onShowOnMap: () => void;
}) {
  const { t } = useTranslation();
  const warnings = route.incidents.filter((i) => i.impact !== "info");
  const infos = route.incidents.length - warnings.length;
  const labelId = `route-option-${index}-label`;
  return (
    <section id={`route-option-${index}`} aria-labelledby={labelId} className="flex flex-col gap-3 rounded-2xl bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 id={labelId} className="pt-0.5 text-xs text-muted-foreground">
          {t("routeOption", { n: index + 1 })}
          {index === 0 && route.risk !== "blocked" && ` · ${t("routeRecommended")}`}
        </h3>
        <RouteRiskBadge risk={route.risk} />
      </div>
      <div className="flex flex-col gap-0.5">
        <p>
          <span className="text-lg font-semibold tabular-nums">{formatDuration(route.duration_s, t)}</span>
          <span className="text-sm text-muted-foreground"> · {formatDistance(route.distance_m, t)}</span>
        </p>
        <p className="text-sm text-muted-foreground">{route.risk === "safe" ? t("routeSafeMeaning") : incidentCountLine(route, t)}</p>
      </div>

      {warnings.length > 0 && (
        <ul className="-mx-1 divide-y divide-border border-t border-border" aria-label={t("routeWarnings")}>
          {warnings.map((w) => {
            const meta = ROUTE_IMPACT_META[w.impact];
            return (
              <li key={w.report.id}>
                <button
                  type="button"
                  onClick={() => onSelectReport(w.report)}
                  className="flex min-h-12 w-full items-center gap-2.5 rounded-lg px-1 py-2.5 text-left text-sm hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                >
                  <CategoryIcon type={w.report.type} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-medium break-words">{reportTitle(t, w.report)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t(`routeReason.${w.reason}`)} · {freshnessLine(w.report, t)}
                    </span>
                  </span>
                  <ToneBadge icon={meta.icon} tone={meta.tone}>
                    {t(`routeImpact.${w.impact}`)}
                  </ToneBadge>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {infos > 0 && <p className="text-xs leading-relaxed text-muted-foreground">{t("routeInfoCount", { n: infos })}</p>}

      <div className="grid grid-cols-2 gap-2 max-[359px]:grid-cols-1">
        <Button variant="outline" className="h-11 rounded-xl" onClick={onShowOnMap}>
          <MapIcon aria-hidden />
          {t("showOnMap")}
        </Button>
        <a
          href={tripDirectionsUrl(origin, destination, walking)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Navigation className="size-4" aria-hidden />
          {t("openInMaps")}
        </a>
      </div>
    </section>
  );
}
