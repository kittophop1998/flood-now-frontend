"use client";

import { useEffect, useState } from "react";
import { ChevronRight, CircleAlert, MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PlaceStatusBadge, StaleDataNote } from "@/components/community/badges";
import { EmptyState, ViewShell } from "@/components/views/view-shell";
import { importantPlacesService } from "@/services/community-service";
import { isAbortError, isNetworkError } from "@/services/api-client";
import { IMPORTANT_PLACE_META } from "@/lib/community-meta";
import { distanceMeters, formatDistance } from "@/lib/distance";
import { readCache, writeCache } from "@/lib/offline-cache";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { LayerFilters } from "@/features/layers/use-viewport-layers";
import {
  IMPORTANT_PLACE_CATEGORIES,
  IMPORTANT_PLACE_STATUSES,
  type ImportantPlace,
  type ImportantPlaceCategory,
  type ImportantPlaceStatus,
  type LatLng,
} from "@/types/community";

const LIST_RADIUS_DEG = 0.15; // ~15 km around the map center
const CACHE_KEY = "important-places-list";

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

// Important places (hospitals, shelters, boat points…) around the map
// center, filterable by category/status; opening one shows it on the map.
export function ImportantPlacesView({
  center,
  layers,
  onLayersChange,
  onOpen,
  onBack,
  hidden,
}: {
  center: LatLng;
  layers: LayerFilters;
  onLayersChange: (next: LayerFilters) => void;
  onOpen: (place: ImportantPlace) => void;
  onBack: () => void;
  hidden?: boolean;
}) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<ImportantPlaceCategory[]>(layers.placeCategories);
  const [statuses, setStatuses] = useState<ImportantPlaceStatus[]>(layers.placeStatuses);
  const [places, setPlaces] = useState<ImportantPlace[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [staleSince, setStaleSince] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const key = `${center.latitude.toFixed(2)},${center.longitude.toFixed(2)}|${categories}|${statuses}`;

  useEffect(() => {
    const controller = new AbortController();
    const bbox = {
      minLat: center.latitude - LIST_RADIUS_DEG,
      maxLat: center.latitude + LIST_RADIUS_DEG,
      minLng: center.longitude - LIST_RADIUS_DEG,
      maxLng: center.longitude + LIST_RADIUS_DEG,
    };
    importantPlacesService
      .list({ bbox, categories, statuses }, controller.signal)
      .then((res) => {
        setPlaces(res.places);
        writeCache(CACHE_KEY, res.places);
        setStaleSince(null);
        setStatus("ready");
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        const cached = isNetworkError(err) ? readCache<ImportantPlace[]>(CACHE_KEY) : null;
        if (cached) {
          setPlaces(cached.data);
          setStaleSince(cached.savedAt);
          setStatus("ready");
        } else setStatus("error");
      });
    return () => controller.abort();
    // `key` captures center/categories/statuses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retry]);

  const sorted = [...places].sort((a, b) => distanceMeters(center, a) - distanceMeters(center, b));

  return (
    <ViewShell title={t("importantPlacesTitle")} subtitle={t("importantPlacesSubtitle")} onBack={onBack} hidden={hidden}>
      <div className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-2 shadow-xs">
        <Label htmlFor="layer-places" className="font-medium">
          {t("layerPlacesToggle")}
        </Label>
        <Switch id="layer-places" checked={layers.places} onCheckedChange={(v) => onLayersChange({ ...layers, places: v, placeCategories: categories, placeStatuses: statuses })} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1" role="group" aria-label={t("filterCategories")}>
          {IMPORTANT_PLACE_CATEGORIES.map((c) => {
            const meta = IMPORTANT_PLACE_META[c];
            const on = categories.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setCategories(toggle(categories, c))}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                )}
              >
                <meta.icon className="size-4" style={on ? undefined : { color: meta.color }} aria-hidden />
                {t(`ipCategory.${c}`)}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("filterStatus")}>
          {IMPORTANT_PLACE_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={statuses.includes(s)}
              onClick={() => setStatuses(toggle(statuses, s))}
              className={cn(
                "min-h-11 rounded-xl border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
                statuses.includes(s) ? "border-primary bg-accent text-primary" : "bg-background hover:bg-muted",
              )}
            >
              {t(`ipStatus.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {staleSince && <StaleDataNote savedAt={staleSince} />}
      <div aria-live="polite" className="flex flex-col gap-2">
        {status === "loading" && [0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-background" aria-hidden />)}
        {status === "error" && (
          <EmptyState
            icon={<CircleAlert />}
            title={t("importantPlacesFailed")}
            action={
              <Button variant="outline" className="mt-2 h-11 rounded-xl" onClick={() => setRetry((n) => n + 1)}>
                {t("retry")}
              </Button>
            }
          />
        )}
        {status === "ready" && sorted.length === 0 && <EmptyState icon={<MapPinOff />} title={t("noImportantPlaces")} hint={t("noImportantPlacesHint")} />}
        {status === "ready" &&
          sorted.map((p) => {
            const meta = IMPORTANT_PLACE_META[p.category];
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpen(p)}
                className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 text-left shadow-xs hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: meta.color }}>
                  <meta.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <PlaceStatusBadge status={p.status} />
                    {t(`ipCategory.${p.category}`)} · {t("distanceAway", { d: formatDistance(distanceMeters(center, p), t) })}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            );
          })}
      </div>
    </ViewShell>
  );
}
