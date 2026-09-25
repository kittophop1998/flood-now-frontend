"use client";

import { useState } from "react";
import { ArrowUpDown, ChevronRight, CircleAlert, Clock, Loader2, Map as MapIcon, Navigation, RouteOff, ShieldAlert, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RouteRiskBadge, ToneBadge } from "@/components/community/badges";
import { LocationField, type LocationValue } from "@/components/community/location-field";
import { CategoryIcon } from "@/components/report/report-badges";
import { EmptyState, ViewShell } from "@/components/views/view-shell";
import type { useRouteEvaluation } from "@/features/route/use-route-evaluation";
import { ROUTE_IMPACT_META } from "@/lib/community-meta";
import { tripDirectionsUrl } from "@/lib/directions";
import { formatDistance } from "@/lib/distance";
import { formatClockTime, freshnessLine } from "@/lib/freshness";
import { VEHICLE_ICON, reportTitle, vehicleLabel } from "@/lib/report-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { EvaluatedRoute, LatLng, RouteEvaluation, SavedPlace } from "@/types/community";
import { VEHICLES, type Report, type Vehicle } from "@/types/report";

export interface RouteDraft {
  origin: LocationValue | null;
  destination: LocationValue | null;
  vehicle: Vehicle;
}

type PickFn = (title: string, onPick: (p: LatLng) => void) => void;

function formatDuration(seconds: number, t: ReturnType<typeof useTranslation>["t"]): string {
  const min = Math.max(1, Math.round(seconds / 60));
  if (min < 60) return t("durationMinutes", { n: min });
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${t("durationHours", { n: h })} ${t("durationMinutes", { n: m })}` : t("durationHours", { n: h });
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
  onPick,
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
  onPick: PickFn;
  onSelectReport: (report: Report) => void;
  onShowOnMap: (result: RouteEvaluation, index: number) => void;
}) {
  const { t, locale } = useTranslation();
  const [missing, setMissing] = useState(false);
  const { state } = evaluation;

  function check() {
    if (!draft.origin || !draft.destination) {
      setMissing(true);
      return;
    }
    setMissing(false);
    evaluation.evaluate(draft.origin, draft.destination, draft.vehicle);
  }

  return (
    <ViewShell title={t("routeTitle")} subtitle={t("routeSubtitle")} onBack={onBack} hidden={hidden}>
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-xs">
        <LocationField
          label={t("routeFrom")}
          labelId="route-origin"
          value={draft.origin}
          onChange={(origin) => onDraftChange({ ...draft, origin })}
          onUseMyLocation={onUseMyLocation}
          onPickOnMap={() => onPick(t("pickOriginTitle"), (p) => onDraftChange({ ...draft, origin: p }))}
          savedPlaces={savedPlaces}
          searchable
          invalid={missing && !draft.origin}
        />
        <Button
          type="button"
          variant="ghost"
          className="h-11 self-center rounded-xl"
          onClick={() => onDraftChange({ ...draft, origin: draft.destination, destination: draft.origin })}
        >
          <ArrowUpDown aria-hidden />
          {t("swapRoute")}
        </Button>
        <LocationField
          label={t("routeTo")}
          labelId="route-destination"
          value={draft.destination}
          onChange={(destination) => onDraftChange({ ...draft, destination })}
          onUseMyLocation={onUseMyLocation}
          onPickOnMap={() => onPick(t("pickDestinationTitle"), (p) => onDraftChange({ ...draft, destination: p }))}
          savedPlaces={savedPlaces}
          searchable
          invalid={missing && !draft.destination}
        />

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t("routeVehicle")}</legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-4">
            {VEHICLES.map((v) => {
              const Icon = VEHICLE_ICON[v];
              const selected = draft.vehicle === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onDraftChange({ ...draft, vehicle: v })}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border px-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    selected ? "border-primary bg-accent text-primary ring-2 ring-primary/30" : "bg-background hover:bg-muted",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {vehicleLabel(t, v)}
                </button>
              );
            })}
          </div>
        </fieldset>

        {missing && (
          <p role="alert" className="text-sm text-destructive">
            {t("routeNeedsBothEnds")}
          </p>
        )}
        <Button className="h-12 rounded-xl text-base" onClick={check} disabled={state.status === "loading"}>
          {state.status === "loading" ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldAlert aria-hidden />}
          {state.status === "loading" ? t("routeChecking") : t("routeCheck")}
        </Button>
      </section>

      <div aria-live="polite" className="flex flex-col gap-3">
        {state.status === "error" && (
          <EmptyState
            icon={state.kind === "offline" ? <WifiOff /> : <CircleAlert />}
            title={
              state.kind === "offline"
                ? t("routeOffline")
                : state.kind === "unavailable"
                  ? t("routeUnavailable")
                  : state.kind === "invalid"
                    ? (state.message ?? t("routeFailed"))
                    : t("routeFailed")
            }
            action={
              <Button variant="outline" className="mt-2 h-11 rounded-xl" onClick={check}>
                {t("retry")}
              </Button>
            }
          />
        )}

        {state.status === "ready" && (
          <>
            <RouteDisclaimer result={state.result} locale={locale} />
            {state.result.routes.length === 0 ? (
              <EmptyState icon={<RouteOff />} title={t("routeNone")} hint={t("routeNoneHint")} />
            ) : (
              <>
                {state.result.routes.every((r) => r.risk === "blocked") && (
                  <p role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-900">
                    {t("routeAllBlocked")}
                  </p>
                )}
                {state.result.routes.map((route, i) => (
                  <RouteCard
                    key={i}
                    index={i}
                    route={route}
                    origin={draft.origin!}
                    destination={draft.destination!}
                    walking={state.result.vehicle === "walk"}
                    onSelectReport={onSelectReport}
                    onShowOnMap={() => onShowOnMap(state.result, i)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </ViewShell>
  );
}

function RouteDisclaimer({ result, locale }: { result: RouteEvaluation; locale: "th" | "en" }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
      <p className="flex items-center gap-1.5 font-semibold">
        <Clock className="size-4" aria-hidden />
        {t("routeDataAsOf", { time: formatClockTime(result.evaluated_at, locale) })}
      </p>
      <p>{t("routeDisclaimerFull")}</p>
      {!result.data_complete && <p className="font-semibold">{t("routeDataIncomplete")}</p>}
    </div>
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
  return (
    <section
      aria-label={t("routeOption", { n: index + 1 })}
      className={cn("flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs", index === 0 && route.risk !== "blocked" && "border-primary/40 ring-1 ring-primary/20")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{t("routeOption", { n: index + 1 })}</h3>
        {index === 0 && route.risk !== "blocked" && <span className="rounded-full bg-accent px-2 text-xs font-semibold text-primary">{t("routeRecommended")}</span>}
        <RouteRiskBadge risk={route.risk} className="ml-auto" />
      </div>
      <p className="text-sm text-muted-foreground">
        {formatDistance(route.distance_m, t)} · {formatDuration(route.duration_s, t)} ·{" "}
        {route.incident_count === 0 ? t("routeNoReports") : t(route.incident_count === 1 ? "routeIncidentCountOne" : "routeIncidentCount", { n: route.incident_count })}
      </p>
      {route.risk === "safe" && <p className="text-xs text-muted-foreground">{t("routeSafeMeaning")}</p>}

      {warnings.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label={t("routeWarnings")}>
          {warnings.map((w) => {
            const meta = ROUTE_IMPACT_META[w.impact];
            return (
              <li key={w.report.id}>
                <button
                  type="button"
                  onClick={() => onSelectReport(w.report)}
                  className="flex min-h-12 w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <CategoryIcon type={w.report.type} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{reportTitle(t, w.report)}</span>
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
      {infos > 0 && <p className="text-xs text-muted-foreground">{t("routeInfoCount", { n: infos })}</p>}

      <div className="grid grid-cols-2 gap-2">
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
