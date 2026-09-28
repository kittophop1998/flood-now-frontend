"use client";

import { useEffect, useRef, useState } from "react";
import { announcementsService, eventsService, importantPlacesService } from "@/services/community-service";
import { isAbortError } from "@/services/api-client";
import { readCache, writeCache } from "@/lib/offline-cache";
import type { Viewport } from "@/features/reports/use-viewport-reports";
import { DEFAULT_GISTDA_PERIOD } from "@/lib/official-flood";
import type { Announcement, CommunityEvent, GistdaPeriod, ImportantPlace, ImportantPlaceCategory, ImportantPlaceStatus } from "@/types/community";

const DEBOUNCE_MS = 400;
// The places layer is detailed; below this zoom a viewport can cover a whole
// region, so it isn't requested (the UI asks the user to zoom in).
export const PLACES_MIN_ZOOM = 10;
const PLACES_CACHE_KEY = "important-places";
// Community events are drawn from the same zoom as places, so a zoomed-out
// safety map never fills up with fairs and markets.
export const EVENTS_MIN_ZOOM = 10;

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
  // Community events (fairs, markets…) — public, separate from incidents.
  events: boolean;
  // The signed-in user's own saved places (private; never for guests).
  savedPlaces: boolean;
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
  events: true,
  savedPlaces: true,
};

// Map overlay data (important places, official announcements) for the
// current viewport — debounced, with stale requests cancelled. Places load
// only while their layer is on; announcements always load, because the map
// banner shows them even when their markers are switched off.
export function useViewportLayers(viewport: Viewport | null, layers: LayerFilters) {
  const [places, setPlaces] = useState<ImportantPlace[]>(() => readCache<ImportantPlace[]>(PLACES_CACHE_KEY)?.data ?? []);
  const [placesStatus, setPlacesStatus] = useState<"idle" | "loading" | "ready" | "error" | "zoom">("idle");
  const [placesStaleSince, setPlacesStaleSince] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  // Bumped after the user creates/edits an event so the layer refetches.
  const [eventsVersion, setEventsVersion] = useState(0);
  const placesAbort = useRef<AbortController | null>(null);
  const annAbort = useRef<AbortController | null>(null);
  const eventsAbort = useRef<AbortController | null>(null);

  // Bumped after this device adds/edits/deletes a place so the layer refetches.
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
          { bbox: viewport.bbox, categories: layers.placeCategories, statuses: layers.placeStatuses },
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
  }, [viewport, layers.places, placeKey]);

  useEffect(() => {
    if (!viewport) return;
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
  }, [viewport]);

  useEffect(() => {
    if (!layers.events || !viewport) return;
    const timer = setTimeout(async () => {
      if (viewport.zoom < EVENTS_MIN_ZOOM) {
        setEvents([]);
        return;
      }
      eventsAbort.current?.abort();
      const controller = new AbortController();
      eventsAbort.current = controller;
      try {
        setEvents(await eventsService.list({ bbox: viewport.bbox }, controller.signal));
      } catch {
        // Keep what's shown; the events screen reports errors.
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [viewport, layers.events, eventsVersion]);

  useEffect(
    () => () => {
      placesAbort.current?.abort();
      annAbort.current?.abort();
      eventsAbort.current?.abort();
    },
    [],
  );

  return {
    places: layers.places ? places : [],
    placesStatus: layers.places ? placesStatus : ("idle" as const),
    placesStaleSince,
    // Announcements with a location are drawn on the map; the rest only list.
    announcements: layers.announcements ? announcements.filter((a) => a.latitude != null && a.longitude != null) : [],
    // Every announcement for this viewport (incl. area-less ones), most severe first.
    bannerAnnouncements: announcements,
    events: layers.events ? events : [],
    reloadEvents: () => setEventsVersion((v) => v + 1),
  };
}
