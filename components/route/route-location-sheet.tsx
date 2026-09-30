"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ChevronRight, Loader2, LocateFixed, MapPinned, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LocationValue } from "@/components/community/location-field";
import { MapLocationPicker } from "@/components/map/map-location-picker";
import type { RouteEnd } from "@/components/route/route-endpoints-card";
import { PLACE_ICON_META } from "@/lib/community-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { LatLng, SavedPlace } from "@/types/community";

const rowClass =
  "flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-base hover:bg-muted focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring disabled:opacity-60";

// Chooser for one end of a route: search (in MapLocationPicker), my location,
// pick on a separate map (never the home map), or a saved place. Mount it
// only while open.
export function RouteLocationSheet({
  end,
  value,
  savedPlaces,
  userLocation,
  onUseMyLocation,
  onChoose,
  onClose,
}: {
  end: RouteEnd;
  value: LocationValue | null;
  savedPlaces: SavedPlace[];
  userLocation: LatLng | null;
  onUseMyLocation: () => Promise<LatLng | null>;
  // The parent stores the value and closes the sheet.
  onChoose: (value: LocationValue) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [picker, setPicker] = useState<{ search: boolean } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateFailed, setLocateFailed] = useState(false);
  // Set in the effect body too, so StrictMode's mount/unmount/mount keeps it true.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => void (mounted.current = false);
  }, []);
  const title = t(end === "origin" ? "pickOriginTitle" : "pickDestinationTitle");

  async function useMine() {
    setLocating(true);
    setLocateFailed(false);
    const loc = await onUseMyLocation();
    if (!mounted.current) return;
    setLocating(false);
    if (loc) onChoose({ ...loc, label: t("myLocation") });
    else setLocateFailed(true);
  }

  return (
    <>
      {/* Hidden (not unmounted) while the full-screen picker is up, so Cancel there comes back here. */}
      <Dialog open={!picker} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="flex max-h-[85dvh] flex-col gap-0 p-0 sm:max-w-md" showCloseButton={false}>
          <DialogHeader className="relative px-4 pt-4 pr-14 pb-3">
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
            <DialogPrimitive.Close
              aria-label={t("close")}
              className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="size-5" aria-hidden />
            </DialogPrimitive.Close>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-3">
            <div className="px-4 pb-2">
              <button
                type="button"
                onClick={() => setPicker({ search: true })}
                className="flex h-12 w-full items-center gap-2 rounded-xl bg-muted px-3 text-left text-base text-muted-foreground hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Search className="size-5 shrink-0" aria-hidden />
                {t("searchAPlace")}
              </button>
            </div>
            <button type="button" className={rowClass} onClick={useMine} disabled={locating} aria-busy={locating || undefined}>
              {locating ? (
                <Loader2 className="size-5 shrink-0 animate-spin text-primary" aria-hidden />
              ) : (
                <LocateFixed className="size-5 shrink-0 text-primary" aria-hidden />
              )}
              <span className="min-w-0 flex-1">{t("myLocation")}</span>
            </button>
            {locateFailed && (
              <p role="status" className="px-4 pb-1 pl-12 text-sm leading-relaxed text-muted-foreground">
                {t("routeLocateFailed")}
              </p>
            )}
            <button type="button" className={rowClass} onClick={() => setPicker({ search: false })}>
              <MapPinned className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1">{t("pickOnMap")}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>

            {savedPlaces.length > 0 && (
              <section aria-labelledby="route-sheet-saved" className="mt-2 border-t border-border">
                <h3 id="route-sheet-saved" className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">
                  {t("savedPlacesTitle")}
                </h3>
                <ul>
                  {savedPlaces.map((p) => {
                    const Icon = PLACE_ICON_META[p.icon];
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          className={rowClass}
                          onClick={() => onChoose({ latitude: p.latitude, longitude: p.longitude, label: p.name })}
                        >
                          <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                          <span className="line-clamp-1 min-w-0 flex-1 break-words">{p.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {picker && (
        <MapLocationPicker
          title={title}
          value={value}
          initialCenter={value ?? userLocation}
          autoFocusSearch={picker.search}
          onCancel={() => setPicker(null)}
          onConfirm={onChoose}
        />
      )}
    </>
  );
}
