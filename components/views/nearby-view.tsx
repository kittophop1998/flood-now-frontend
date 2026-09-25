"use client";

import { useState } from "react";
import { CircleAlert, LocateFixed, MapPinned, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportCard } from "@/components/report/report-card";
import { EmptyState, ViewShell } from "@/components/views/view-shell";
import { useNearbyReports } from "@/features/reports/use-location-lookups";
import { useNow } from "@/features/common/use-now";
import { formatDistance } from "@/lib/distance";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { NEARBY_SORTS, type NearbySort, type Report } from "@/types/report";

type LatLng = { latitude: number; longitude: number };

const NEARBY_RADIUS_M = 5000;

// Open incidents around the user (or the map center when location is off),
// as cards sortable by distance, recency or severity.
export function NearbyView({
  userLocation,
  mapCenter,
  locationBlocked,
  locating,
  onLocate,
  onSelect,
}: {
  userLocation: LatLng | null;
  mapCenter: LatLng;
  locationBlocked: boolean;
  locating: boolean;
  onLocate: () => void;
  onSelect: (report: Report) => void;
}) {
  const { t } = useTranslation();
  const now = useNow();
  const [sort, setSort] = useState<NearbySort>("distance");
  const origin = userLocation ?? mapCenter;
  const { data, status, retry } = useNearbyReports(origin, sort, NEARBY_RADIUS_M);
  const radiusText = formatDistance(NEARBY_RADIUS_M, t);

  return (
    <ViewShell
      title={t("nearbyTitle")}
      subtitle={
        <span className="flex items-center gap-1.5">
          {userLocation ? <LocateFixed className="size-3.5" aria-hidden /> : <MapPinned className="size-3.5" aria-hidden />}
          {userLocation ? t("nearbyAroundYou") : t("nearbyAroundMap")} · {t("nearbyRadius", { d: radiusText })}
        </span>
      }
    >
      {!userLocation && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <CircleAlert className="size-5 shrink-0 text-amber-700" aria-hidden />
          <p className="min-w-0 flex-1">{locationBlocked ? t("locationDenied") : t("locationUnavailable")}</p>
          {!locationBlocked && (
            <Button variant="outline" className="h-11 shrink-0 rounded-xl bg-background" onClick={onLocate} disabled={locating}>
              <LocateFixed aria-hidden />
              {t("useMyLocation")}
            </Button>
          )}
        </div>
      )}

      <div role="radiogroup" aria-label={t("filtersTitle")} className="grid grid-cols-3 gap-1 rounded-xl bg-background p-1 shadow-xs">
        {NEARBY_SORTS.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={sort === s}
            onClick={() => setSort(s)}
            className={cn(
              "min-h-11 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              sort === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t(`sort.${s}`)}
          </button>
        ))}
      </div>

      <div aria-live="polite" aria-busy={status === "loading"} className="flex flex-col gap-3">
        {status === "loading" &&
          [0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-background" aria-hidden />)}

        {status === "error" && (
          <EmptyState
            icon={<CircleAlert />}
            title={t("nearbyFailed")}
            action={
              <Button variant="outline" className="mt-2 h-11 rounded-xl" onClick={retry}>
                {t("retry")}
              </Button>
            }
          />
        )}

        {status === "ready" && data.length === 0 && (
          <EmptyState icon={<ShieldCheck />} title={t("nearbyEmpty", { d: radiusText })} hint={t("nearbyEmptyHint")} />
        )}

        {status === "ready" &&
          data.map((report) => (
            <ReportCard key={report.id} report={report} now={now} distanceM={report.distance_m} onSelect={() => onSelect(report)} />
          ))}
      </div>
    </ViewShell>
  );
}
