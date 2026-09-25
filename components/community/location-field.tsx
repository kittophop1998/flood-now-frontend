"use client";

import { useState } from "react";
import { Loader2, LocateFixed, MapPin, MapPinned, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApproximateAddress } from "@/features/reports/use-location-lookups";
import { usePlaceSearch } from "@/features/reports/use-place-search";
import { PLACE_ICON_META } from "@/lib/community-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { LatLng, SavedPlace } from "@/types/community";

export interface LocationValue extends LatLng {
  label?: string;
}

// One place to choose a point for a saved place, a route end or an SOS:
// current location, a point picked on the map, a saved place, or a search
// result. Shows the approximate address of the chosen point.
export function LocationField({
  label,
  labelId,
  value,
  onChange,
  onUseMyLocation,
  onPickOnMap,
  savedPlaces,
  searchable,
  invalid,
}: {
  label: string;
  labelId: string;
  value: LocationValue | null;
  onChange: (value: LocationValue) => void;
  onUseMyLocation: () => Promise<LatLng | null>;
  onPickOnMap: () => void;
  savedPlaces?: SavedPlace[];
  searchable?: boolean;
  invalid?: boolean;
}) {
  const { t } = useTranslation();
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const search = usePlaceSearch();
  // Named points (saved place, search result) skip the rate-limited geocoder.
  const { place, status } = useApproximateAddress(value?.label ? null : value);

  async function useMine() {
    setLocating(true);
    const loc = await onUseMyLocation();
    setLocating(false);
    if (loc) onChange({ ...loc, label: t("myLocation") });
  }

  const shown = value?.label ?? place?.name ?? (value && status === "loading" ? t("locatingAddress") : null);

  return (
    <div className="flex flex-col gap-2" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="text-sm font-semibold">
        {label}
      </span>
      <div
        className={cn(
          "flex min-h-12 items-start gap-2.5 rounded-xl border bg-muted/60 px-3 py-2.5",
          invalid && "border-destructive/60",
        )}
        aria-live="polite"
      >
        <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {value ? (
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium">{shown ?? t("locationPinned")}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("locationNotChosen")}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={useMine} disabled={locating}>
          {locating ? <Loader2 className="animate-spin" aria-hidden /> : <LocateFixed aria-hidden />}
          {t("myLocation")}
        </Button>
        <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={onPickOnMap}>
          <MapPinned aria-hidden />
          {t("pickOnMap")}
        </Button>
      </div>
      {savedPlaces && savedPlaces.length > 0 && (
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5" aria-label={t("savedPlacesTitle")}>
          {savedPlaces.map((p) => {
            const Icon = PLACE_ICON_META[p.icon];
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange({ latitude: p.latitude, longitude: p.longitude, label: p.name })}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border bg-background px-3 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Icon className="size-4 text-primary" aria-hidden />
                {p.name}
              </button>
            );
          })}
        </div>
      )}
      {searchable &&
        (searchOpen ? (
          <div className="flex flex-col gap-1.5">
            <form
              role="search"
              className="flex h-11 items-center gap-1 rounded-xl border bg-background pr-1 pl-3 focus-within:ring-2 focus-within:ring-ring/50"
              onSubmit={(e) => {
                e.preventDefault();
                search.search(query);
              }}
            >
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                type="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchPlaceholder")}
                className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-base outline-none"
              />
            </form>
            {search.status === "loading" && <p className="px-1 text-xs text-muted-foreground">{t("loading")}</p>}
            {search.status === "error" && <p className="px-1 text-xs text-destructive">{t("searchFailed")}</p>}
            {search.status === "ready" && search.results.length === 0 && (
              <p className="px-1 text-xs text-muted-foreground">{t("searchNoResults")}</p>
            )}
            {search.results.length > 0 && (
              <ul className="max-h-56 overflow-y-auto rounded-xl border bg-background py-1">
                {search.results.map((r) => (
                  <li key={`${r.latitude},${r.longitude}`}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full flex-col px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                      onClick={() => {
                        onChange({ latitude: r.latitude, longitude: r.longitude, label: r.name });
                        search.clear();
                        setSearchOpen(false);
                        setQuery("");
                      }}
                    >
                      <span className="truncate text-sm font-medium">{r.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{r.display_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <Button type="button" variant="ghost" className="h-11 justify-start rounded-xl text-primary" onClick={() => setSearchOpen(true)}>
            <Search aria-hidden />
            {t("searchAPlace")}
          </Button>
        ))}
    </div>
  );
}
