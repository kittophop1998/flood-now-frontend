"use client";

import { useEffect, useRef, useState } from "react";
import { announcementsService, importantPlacesService } from "@/services/community-service";
import { isAbortError } from "@/services/api-client";
import { getDeviceId } from "@/lib/device-id";
import { readCache, writeCache } from "@/lib/offline-cache";
import type { Viewport } from "@/features/reports/use-viewport-reports";
import { DEFAULT_GISTDA_PERIOD } from "@/lib/official-flood";
import type { Announcement, GistdaPeriod, ImportantPlace, ImportantPlaceCategory, ImportantPlaceStatus } from "@/types/community";

const DEBOUNCE_MS = 400;
// The places layer is detailed; below this zoom a viewport can cover a whole
// region, so it isn't requested (the UI asks the user to zoom in).
export const PLACES_MIN_ZOOM = 10;
const PLACES_CACHE_KEY = "important-places";

export interface LayerFilters {
  // Community report markers/zones (data keeps loading; only drawing stops).
  reports: boolean;
  places: boolean;
  announcements: boolean;
  placeCategories: ImportantPlaceCategory[];
  placeStatuses: ImportantPlaceStatus[];
  // Official GISTDA flood areas (features/layers/use-gistda-flood.ts).
  gistdaFlood: boolean;
  gistdaPeriod: GistdaPeriod;
  // Official DOH highway cameras (features/layers/use-doh-cctv.ts).
  dohCctv: boolean;
}

export const DEFAULT_LAYERS: LayerFilters = {
  reports: true,
  places: false,
  announcements: true,
  placeCategories: [],
  placeStatuses: [],
  gistdaFlood: false,
  gistdaPeriod: DEFAULT_GISTDA_PERIOD,
  dohCctv: false,
};

// Map overlay data (important places, official announcements) for the
// current viewport — only for layers that are switched on, debounced, with
// stale requests cancelled.
export function useViewportLayers(viewport: Viewport | null, layers: LayerFilters) {
  const [places, setPlaces] = useState<ImportantPlace[]>(() => readCache<ImportantPlace[]>(PLACES_CACHE_KEY)?.data ?? []);
  const [placesStatus, setPlacesStatus] = useState<"idle" | "loading" | "ready" | "error" | "zoom">("idle");
  const [placesStaleSince, setPlacesStaleSince] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const placesAbort = useRef<AbortController | null>(null);
  const annAbort = useRef<AbortController | null>(null);

  // Bumped after this device adds/edits/deletes a place so the layer refetches.
  const [placesVersion, setPlacesVersion] = useState(0);
  const placeKey = JSON.stringify([layers.placeCategories, layers.placeStatuses]);
  useEffect(() => {
    if (!layers.places || !viewport) return;
    const timer = setTimeout(async () => {
      if (viewport.zoom < PLACES_MIN_ZOOM) {
        setPlacesStatus("zoom");
        return;
      }
      placesAbort.current?.abort();
      const controller = new AbortController();
      placesAbort.current = controller;
      setPlacesStatus((s) => (s === "ready" ? s : "loading"));
      try {
        const res = await importantPlacesService.list(
          { bbox: viewport.bbox, categories: layers.placeCategories, statuses: layers.placeStatuses, deviceId: getDeviceId() },
          controller.signal,
        );
        setPlaces(res.places);
        writeCache(PLACES_CACHE_KEY, res.places);
        setPlacesStaleSince(null);
        setPlacesStatus("ready");
      } catch (err) {
        if (isAbortError(err)) return;
        const cached = readCache<ImportantPlace[]>(PLACES_CACHE_KEY);
        if (cached) {
          setPlaces(cached.data);
          setPlacesStaleSince(cached.savedAt);
          setPlacesStatus("ready");
        } else {
          setPlacesStatus("error");
        }
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // placeKey stands in for the filter arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport, layers.places, placeKey, placesVersion]);

  useEffect(() => {
    if (!layers.announcements || !viewport) return;
    const timer = setTimeout(async () => {
      annAbort.current?.abort();
      const controller = new AbortController();
      annAbort.current = controller;
      try {
        setAnnouncements(await announcementsService.list({ bbox: viewport.bbox }, controller.signal));
      } catch {
        // Keep what's shown; the announcements list screen reports errors.
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [viewport, layers.announcements]);

  useEffect(
    () => () => {
      placesAbort.current?.abort();
      annAbort.current?.abort();
    },
    [],
  );

  return {
    places: layers.places ? places : [],
    placesStatus: layers.places ? placesStatus : ("idle" as const),
    placesStaleSince,
    reloadPlaces: () => setPlacesVersion((v) => v + 1),
    // Announcements with a location are drawn on the map; the rest only list.
    announcements: layers.announcements ? announcements.filter((a) => a.latitude != null && a.longitude != null) : [],
  };
}
