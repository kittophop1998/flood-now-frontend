"use client";

import { useState } from "react";
import { ChevronDown, CircleAlert, Info, Radar, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AreaLevelBadge, StaleDataNote } from "@/components/community/badges";
import { ReportCard } from "@/components/report/report-card";
import { EmptyState, ViewShell } from "@/components/views/view-shell";
import { useNow } from "@/features/common/use-now";
import { useNearbyReports } from "@/features/reports/use-location-lookups";
import type { SavedPlacesApi } from "@/features/places/use-saved-places";
import { PLACE_ICON_META } from "@/lib/community-meta";
import { formatDistance } from "@/lib/distance";
import { formatFreshness } from "@/lib/freshness";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { WATCH_RADII_M, type SavedPlace } from "@/types/community";
import type { Report } from "@/types/report";

// Watch areas: each saved place's radius, its current status and open
// incidents, with notifications and radius editable in place. Alerts land in
// the in-app Alerts feed (no push delivery).
export function WatchView({
  places,
  onBack,
  hidden,
  onAddPlace,
  onSelectReport,
}: {
  places: SavedPlacesApi;
  onBack: () => void;
  hidden?: boolean;
  onAddPlace: () => void;
  onSelectReport: (report: Report) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ViewShell title={t("watchTitle")} subtitle={t("watchSubtitle")} onBack={onBack} hidden={hidden}>
      <p className="flex items-start gap-2 rounded-2xl bg-background p-3 text-xs leading-relaxed text-muted-foreground shadow-xs">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("watchRuleNote")}
      </p>
      {places.staleSince && <StaleDataNote savedAt={places.staleSince} />}

      {places.status === "loading" && places.places.length === 0 && <div className="h-28 animate-pulse rounded-2xl bg-background" aria-hidden />}
      {places.status === "error" && (
        <EmptyState
          icon={<CircleAlert />}
          title={t("placesLoadFailed")}
          action={
            <Button variant="outline" className="mt-2 h-11 rounded-xl" onClick={places.reload}>
              {t("retry")}
            </Button>
          }
        />
      )}
      {places.status === "ready" && places.places.length === 0 && (
        <EmptyState
          icon={<Radar />}
          title={t("noWatchAreas")}
          hint={t("noWatchAreasHint")}
          action={
            <Button className="mt-2 h-11 rounded-xl" onClick={onAddPlace}>
              {t("addPlace")}
            </Button>
          }
        />
      )}
      {places.actionError && (
        <p role="alert" className="text-sm text-destructive">
          {places.actionError}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {places.places.map((p) => (
          <WatchCard
            key={p.id}
            place={p}
            expanded={open === p.id}
            onToggle={() => setOpen(open === p.id ? null : p.id)}
            onUpdate={(patch) => places.update(p.id, patch)}
            onSelectReport={onSelectReport}
          />
        ))}
      </ul>
    </ViewShell>
  );
}

function WatchCard({
  place,
  expanded,
  onToggle,
  onUpdate,
  onSelectReport,
}: {
  place: SavedPlace;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: { notification_enabled?: boolean; watch_radius_m?: number }) => Promise<boolean>;
  onSelectReport: (report: Report) => void;
}) {
  const { t } = useTranslation();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const Icon = PLACE_ICON_META[place.icon];
  const panelId = `watch-${place.id}`;

  async function patch(p: { notification_enabled?: boolean; watch_radius_m?: number }) {
    setBusy(true);
    await onUpdate(p);
    setBusy(false);
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border bg-card p-3.5 shadow-xs">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{place.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <AreaLevelBadge level={place.area.level} />
            {place.area.severe_count > 0 && (
              <span className="text-xs font-semibold text-red-700">{t("areaSevereCount", { n: place.area.severe_count })}</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(place.area.active_count === 1 ? "areaActiveCountOne" : "areaActiveCount", { n: place.area.active_count, d: formatDistance(place.watch_radius_m, t) })}
            {place.area.latest_update_at && <> · {t("latestUpdate", { ago: formatFreshness(place.area.latest_update_at, t, now) })}</>}
          </p>
        </div>
      </div>

      <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-muted px-3">
        <Label htmlFor={`notify-${place.id}`} className="font-normal leading-snug">
          {t("watchNotifyLabel")}
        </Label>
        <Switch
          id={`notify-${place.id}`}
          checked={place.notification_enabled}
          disabled={busy}
          onCheckedChange={(v) => patch({ notification_enabled: v })}
        />
      </div>

      <div role="radiogroup" aria-label={t("watchRadiusLabel")} className="grid grid-cols-3 gap-2">
        {WATCH_RADII_M.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={place.watch_radius_m === r}
            disabled={busy}
            onClick={() => place.watch_radius_m !== r && patch({ watch_radius_m: r })}
            className={cn(
              "min-h-11 rounded-xl border text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60",
              place.watch_radius_m === r ? "border-primary bg-accent text-primary" : "bg-background hover:bg-muted",
            )}
          >
            {formatDistance(r, t)}
          </button>
        ))}
      </div>

      <Button variant="outline" className="h-11 justify-between rounded-xl" aria-expanded={expanded} aria-controls={panelId} onClick={onToggle}>
        {t("activeIncidents")} ({place.area.active_count})
        <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} aria-hidden />
      </Button>
      {expanded && <AreaIncidents id={panelId} place={place} onSelectReport={onSelectReport} />}
    </li>
  );
}

function AreaIncidents({ id, place, onSelectReport }: { id: string; place: SavedPlace; onSelectReport: (r: Report) => void }) {
  const { t } = useTranslation();
  const now = useNow();
  const { data, status, retry } = useNearbyReports(place, "severity", place.watch_radius_m);
  return (
    <div id={id} aria-live="polite" className="flex flex-col gap-2">
      {status === "loading" && <div className="h-20 animate-pulse rounded-xl bg-muted" aria-hidden />}
      {status === "error" && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <CircleAlert className="size-4" aria-hidden />
          {t("nearbyFailed")}
          <button type="button" className="font-semibold underline" onClick={retry}>
            {t("retry")}
          </button>
        </p>
      )}
      {status === "ready" && data.length === 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900">
          <ShieldCheck className="size-4" aria-hidden />
          {t("noIncidentsInArea")}
        </p>
      )}
      {status === "ready" &&
        data.map((r) => <ReportCard key={r.id} report={r} now={now} distanceM={r.distance_m} onSelect={() => onSelectReport(r)} />)}
    </div>
  );
}
