"use client";

import { Navigation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RouteRiskBadge } from "@/components/community/badges";
import { tripDirectionsUrl } from "@/lib/directions";
import { formatDistance } from "@/lib/distance";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { LatLng, RouteEvaluation } from "@/types/community";

// Floating card while candidate routes are drawn on the map: pick one,
// hand the trip to the maps app, or clear the overlay.
export function RouteSummary({
  result,
  selected,
  origin,
  destination,
  onSelect,
  onClose,
  onDetails,
}: {
  result: RouteEvaluation;
  selected: number;
  origin: LatLng;
  destination: LatLng;
  onSelect: (index: number) => void;
  onClose: () => void;
  onDetails: () => void;
}) {
  const { t } = useTranslation();
  const route = result.routes[selected];
  return (
    <section
      aria-labelledby="route-summary-title"
      className="absolute inset-x-3 bottom-[calc(var(--nav-h)+0.75rem)] z-30 flex flex-col gap-2.5 rounded-2xl border bg-background p-3.5 shadow-xl sm:right-auto sm:left-4 sm:w-[400px]"
    >
      <div className="flex items-center gap-2">
        <h2 id="route-summary-title" className="font-semibold">
          {t("routeOption", { n: selected + 1 })}
        </h2>
        <RouteRiskBadge risk={route.risk} />
        <Button variant="ghost" size="icon" className="-my-1 ml-auto size-11 rounded-full" aria-label={t("routeClear")} onClick={onClose}>
          <X className="size-5" />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {formatDistance(route.distance_m, t)} · {route.incident_count === 0 ? t("routeNoReports") : t(route.incident_count === 1 ? "routeIncidentCountOne" : "routeIncidentCount", { n: route.incident_count })}
      </p>
      {result.routes.length > 1 && (
        <div role="radiogroup" aria-label={t("routeOptions")} className="flex gap-1.5">
          {result.routes.map((r, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={i === selected}
              onClick={() => onSelect(i)}
              className={cn(
                "min-h-11 flex-1 rounded-xl border text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
                i === selected ? "border-primary bg-accent text-primary" : "bg-background hover:bg-muted",
              )}
            >
              {i + 1} · {t(`routeRisk.${r.risk}`)}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11 rounded-xl" onClick={onDetails}>
          {t("routeDetails")}
        </Button>
        <a
          href={tripDirectionsUrl(origin, destination, result.vehicle === "walk")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Navigation className="size-4" aria-hidden />
          {t("openInMaps")}
        </a>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">{t("routeMapDisclaimer")}</p>
    </section>
  );
}
