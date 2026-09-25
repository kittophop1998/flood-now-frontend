"use client";

import { Check, ChevronRight, CircleAlert, Loader2, LocateFixed, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/report/report-badges";
import { useApproximateAddress, useNearbyReports } from "@/features/reports/use-location-lookups";
import { formatDistance } from "@/lib/distance";
import { reportTitle } from "@/lib/report-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { Report } from "@/types/report";

type LatLng = { latitude: number; longitude: number };

// Matches the largest per-category duplicate radius on the server.
const PIN_CHECK_RADIUS_M = 150;

// Bottom panel while placing the report pin. Before the location is
// confirmed it shows the approximate address and any open reports right at
// the pin, so people can spot an existing report before writing a new one.
export function LocationPicker({
  ref,
  point,
  locating,
  onUseMyLocation,
  onCancel,
  onConfirm,
  onOpenReport,
}: {
  ref?: React.Ref<HTMLElement>;
  point: LatLng;
  locating: boolean;
  onUseMyLocation: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  onOpenReport: (report: Report) => void;
}) {
  const { t } = useTranslation();
  const { place, status: addressStatus } = useApproximateAddress(point);
  const nearby = useNearbyReports(point, "distance", PIN_CHECK_RADIUS_M);

  return (
    <section
      ref={ref}
      aria-labelledby="picker-title"
      className="absolute inset-x-0 bottom-0 z-30 flex flex-col gap-3 rounded-t-3xl border border-b-0 bg-background px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(15,23,42,0.14)] sm:left-4 sm:w-[420px] sm:right-auto sm:bottom-4 sm:rounded-3xl sm:border-b"
    >
      <div>
        <h2 id="picker-title" className="text-lg font-semibold">
          {t("pickTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("dragPinHint")}</p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl bg-muted px-3 py-2.5">
        <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 text-sm" aria-live="polite">
          <p className="truncate font-medium">
            {place?.name ?? (addressStatus === "loading" ? t("locatingAddress") : t("locationPinned"))}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
          </p>
        </div>
      </div>

      <div aria-live="polite" className="flex flex-col gap-1.5">
        {nearby.status === "loading" && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {t("loading")}
          </p>
        )}
        {nearby.status === "error" && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleAlert className="size-3.5" aria-hidden />
            {t("nearbyAtPinFailed")}
          </p>
        )}
        {nearby.status === "ready" && nearby.data.length === 0 && <p className="text-xs text-muted-foreground">{t("noneAtPin")}</p>}
        {nearby.status === "ready" && nearby.data.length > 0 && (
          <>
            <p className="text-xs font-semibold text-amber-800">{t("nearbyAtPin", { n: nearby.data.length })}</p>
            <ul className="flex flex-col gap-1.5">
              {nearby.data.slice(0, 2).map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onOpenReport(r)}
                    className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-2.5 py-1.5 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <CategoryIcon type={r.type} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-medium">{reportTitle(t, r)}</span>
                    {r.distance_m != null && (
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDistance(r.distance_m, t)}</span>
                    )}
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={onUseMyLocation} disabled={locating}>
          {locating ? <Loader2 className="animate-spin" aria-hidden /> : <LocateFixed aria-hidden />}
          {t("useMyLocation")}
        </Button>
        <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={onCancel}>
          <X aria-hidden />
          {t("cancel")}
        </Button>
        <Button type="button" className="col-span-2 h-12 rounded-xl text-base" onClick={onConfirm}>
          <Check aria-hidden />
          {t("useThisSpot")}
        </Button>
      </div>
    </section>
  );
}
