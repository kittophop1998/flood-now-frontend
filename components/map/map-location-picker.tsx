"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Check, CircleAlert, Loader2, LocateFixed, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MapNotice } from "@/components/map/map-states";
import type { LocationValue } from "@/components/community/location-field";
import { useApproximateAddress } from "@/features/reports/use-location-lookups";
import { usePlaceSearch } from "@/features/reports/use-place-search";
import { DEFAULT_CENTER, requestPosition } from "@/features/reports/use-geolocation";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { LatLng } from "@/types/community";

const PickerMap = dynamic(() => import("@/components/map/picker-map").then((m) => m.PickerMap), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-muted" />,
});

// Full-screen "choose a point" screen for forms outside the home map (saved
// places, and any other More/Settings feature): search a place, tap the map
// or use my location to drop a pin, then OK. It keeps its own selection
// until confirmed, so Cancel leaves the parent's value untouched. Mount it
// only while open; it has its own map and never touches the home map.
export function MapLocationPicker({
  title,
  value,
  initialCenter,
  autoFocusSearch,
  onCancel,
  onConfirm,
}: {
  title: string;
  // The currently chosen location, shown as the starting pin.
  value: LocationValue | null;
  // Where to look when nothing is chosen yet (defaults to Bangkok).
  initialCenter?: LatLng | null;
  // Opened from "search a place": focus the search box.
  autoFocusSearch?: boolean;
  onCancel: () => void;
  onConfirm: (location: LocationValue) => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<LocationValue | null>(value);
  const [flyTarget, setFlyTarget] = useState<LatLng | null>(null);
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<"denied" | "unavailable" | null>(null);
  const [mapState, setMapState] = useState<"loading" | "ready" | "error">("loading");
  const search = usePlaceSearch();
  const searchRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);
  // Named points (search result, my location) skip the rate-limited geocoder.
  const { place, status: addressStatus } = useApproximateAddress(selected && !selected.label ? selected : null);

  function select(next: LocationValue, fly: boolean) {
    setSelected(next);
    setGeoError(null);
    search.clear();
    if (fly) setFlyTarget({ latitude: next.latitude, longitude: next.longitude });
  }

  function useMyLocation() {
    setLocating(true);
    requestPosition((state) => {
      if (!mounted.current) return;
      setLocating(false);
      if (state.status === "granted") select({ latitude: state.latitude, longitude: state.longitude, label: t("myLocation") }, true);
      else if (state.status !== "loading") setGeoError(state.status);
    }, true);
  }

  const name = selected?.label ?? place?.name ?? (selected && addressStatus === "loading" ? t("locatingAddress") : null);
  const center = value ?? initialCenter ?? DEFAULT_CENTER;

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onCancel()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Popup
          initialFocus={autoFocusSearch ? searchRef : true}
          className="fixed inset-0 z-50 flex flex-col bg-background outline-none sm:inset-6 sm:mx-auto sm:max-w-2xl sm:overflow-hidden sm:rounded-3xl sm:border sm:shadow-[0_24px_60px_-12px_rgba(15,23,42,0.45)]"
        >
          <header className="flex shrink-0 flex-col gap-2 border-b bg-background px-3 pt-[calc(var(--safe-top)+0.75rem)] pb-3 sm:pt-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onCancel}
                aria-label={t("cancel")}
                className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X className="size-5" aria-hidden />
              </button>
              <DialogPrimitive.Title className="min-w-0 truncate text-lg font-semibold">{title}</DialogPrimitive.Title>
            </div>
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
                ref={searchRef}
                type="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchPlaceholder")}
                className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-base outline-none"
              />
              <Button type="submit" variant="ghost" className="h-9 rounded-lg px-3" disabled={query.trim().length < 2 || search.status === "loading"}>
                {search.status === "loading" ? <Loader2 className="animate-spin" aria-hidden /> : t("searchButton")}
              </Button>
            </form>
          </header>

          <div className="relative min-h-0 flex-1">
            <PickerMap
              initialCenter={center}
              initialZoom={value ? 16 : 14}
              flyTarget={flyTarget}
              marker={selected}
              onPick={(p) => select(p, false)}
              onLoad={() => setMapState("ready")}
              // Tile hiccups after load are harmless; only a map that never
              // loaded (style/network failure) needs a notice.
              onError={() => setMapState((s) => (s === "loading" ? "error" : s))}
            />

            <div aria-live="polite" className="pointer-events-none absolute inset-x-3 top-3 flex flex-col items-center gap-2">
              {search.status === "error" && (
                <MapNotice icon={<CircleAlert />} tone="error">
                  {t("searchFailed")}
                </MapNotice>
              )}
              {search.status === "ready" && search.results.length === 0 && (
                <MapNotice icon={<Search />}>{t("searchNoResults")}</MapNotice>
              )}
              {search.results.length > 0 && (
                <ul
                  aria-label={t("searchPlaceholder")}
                  className="pointer-events-auto max-h-[45dvh] w-full max-w-md overflow-y-auto rounded-2xl border bg-background py-1 shadow-md"
                >
                  {search.results.map((r) => (
                    <li key={`${r.latitude},${r.longitude}`}>
                      <button
                        type="button"
                        className="flex min-h-11 w-full flex-col px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                        onClick={() => select({ latitude: r.latitude, longitude: r.longitude, label: r.name }, true)}
                      >
                        <span className="truncate text-sm font-medium">{r.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{r.display_name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {mapState === "error" && (
                <MapNotice icon={<CircleAlert />} tone="warn">
                  {t("pickerMapFailed")}
                </MapNotice>
              )}
              {geoError && (
                <MapNotice icon={<LocateFixed />} tone="warn">
                  {t(geoError === "denied" ? "locationDenied" : "locationUnavailable")}
                </MapNotice>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("useMyLocation")}
              onClick={useMyLocation}
              disabled={locating}
              className="absolute right-2.5 bottom-28 size-11 rounded-full bg-background shadow-md"
            >
              {locating ? <Loader2 className="animate-spin" aria-hidden /> : <LocateFixed aria-hidden />}
            </Button>
          </div>

          <footer className="flex shrink-0 flex-col gap-3 border-t bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex min-h-12 items-start gap-2.5 rounded-xl bg-muted px-3 py-2.5" aria-live="polite">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {selected ? (
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium">{name ?? t("locationPinned")}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
                  </p>
                </div>
              ) : (
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{t("locationNotChosen")}</p>
                  <p className="text-xs text-muted-foreground">{t("tapMapHint")}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={onCancel}>
                {t("cancel")}
              </Button>
              <Button
                type="button"
                className="h-12 rounded-xl text-base"
                disabled={!selected}
                onClick={() => selected && onConfirm(selected.label || !place ? selected : { ...selected, label: place.name })}
              >
                <Check aria-hidden />
                {t("confirmLocation")}
              </Button>
            </div>
          </footer>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
