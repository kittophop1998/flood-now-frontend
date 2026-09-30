"use client";

import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LocationValue } from "@/components/community/location-field";
import { useApproximateAddress } from "@/features/reports/use-location-lookups";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

export type RouteEnd = "origin" | "destination";

export function routeEndRowId(end: RouteEnd) {
  return `route-${end}-row`;
}

// Start and destination as two tappable rows joined by a dotted line, with a
// swap button on the divider. Tapping a row opens the location chooser; the
// rows show a place name only (never coordinates).
export function RouteEndpointsCard({
  origin,
  destination,
  onEdit,
  onSwap,
  invalidEnds = [],
}: {
  origin: LocationValue | null;
  destination: LocationValue | null;
  onEdit: (end: RouteEnd) => void;
  onSwap: () => void;
  // Ends left empty when the user tried to check the route.
  invalidEnds?: RouteEnd[];
}) {
  const { t } = useTranslation();
  return (
    <div className="relative rounded-2xl bg-card">
      <EndpointRow end="origin" value={origin} invalid={invalidEnds.includes("origin")} onEdit={() => onEdit("origin")} />
      <div className="mr-14 ml-12 border-t border-border" aria-hidden />
      <EndpointRow end="destination" value={destination} invalid={invalidEnds.includes("destination")} onEdit={() => onEdit("destination")} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-1/2 right-2 size-11 -translate-y-1/2 rounded-full text-muted-foreground [&_svg:not([class*='size-'])]:size-5"
        aria-label={t("routeSwapAria")}
        disabled={!origin && !destination}
        onClick={onSwap}
      >
        <ArrowUpDown aria-hidden />
      </Button>
    </div>
  );
}

function EndpointRow({ end, value, invalid, onEdit }: { end: RouteEnd; value: LocationValue | null; invalid: boolean; onEdit: () => void }) {
  const { t } = useTranslation();
  // Named points (saved place, search result, my location) skip the geocoder.
  const { place, status } = useApproximateAddress(value && !value.label ? value : null);
  const isOrigin = end === "origin";
  const label = t(isOrigin ? "routeFrom" : "routeTo");
  const placeholder = t(isOrigin ? "pickOriginTitle" : "pickDestinationTitle");
  const shown = value ? (value.label ?? place?.name ?? (status === "loading" ? t("locatingAddress") : t("locationPinned"))) : null;

  return (
    <button
      id={routeEndRowId(end)}
      type="button"
      onClick={onEdit}
      aria-label={t("routeEditAria", { label, place: shown ?? placeholder })}
      className={cn(
        "relative flex min-h-14 w-full items-center gap-3 rounded-2xl py-2.5 pr-16 pl-4 text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
        invalid && "bg-destructive/5",
      )}
    >
      {/* Dotted connector between the two markers (half in each row). */}
      <span
        aria-hidden
        className={cn(
          "absolute left-[21px] w-px border-l-2 border-dotted border-border",
          isOrigin ? "top-[calc(50%+0.5rem)] bottom-0" : "top-0 bottom-[calc(50%+0.5rem)]",
        )}
      />
      <span aria-hidden className="flex w-3 shrink-0 justify-center">
        <span className={cn("size-3 rounded-full", isOrigin ? "border-2 border-primary bg-background" : "bg-primary")} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("text-xs text-muted-foreground", invalid && "text-destructive")}>{label}</span>
        <span aria-live="polite" className={cn("line-clamp-2 text-base font-medium break-words", !shown && "font-normal text-muted-foreground")}>
          {shown ?? placeholder}
        </span>
      </span>
    </button>
  );
}
