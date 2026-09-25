"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { reportsService } from "@/services/reports-service";
import { ApiError, isAbortError } from "@/services/api-client";
import { toListQuery, type MapFilters } from "@/lib/map-filters";
import { isOpen } from "@/lib/report-status";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { BoundingBox, Report } from "@/types/report";

const DEBOUNCE_MS = 350;
const POLL_INTERVAL_MS = 60_000;
// A fetched region stays good for this long; panning inside it is free.
const REGION_MAX_AGE_MS = 30_000;
// Fetch a margin around the visible area so small pans don't refetch.
const PAD_RATIO = 0.3;

export interface Viewport {
  bbox: BoundingBox;
  zoom: number;
  center: { latitude: number; longitude: number };
}

function pad(b: BoundingBox): BoundingBox {
  const dLat = (b.maxLat - b.minLat) * PAD_RATIO;
  const dLng = (b.maxLng - b.minLng) * PAD_RATIO;
  return {
    minLat: Math.max(-90, b.minLat - dLat),
    maxLat: Math.min(90, b.maxLat + dLat),
    minLng: Math.max(-180, b.minLng - dLng),
    maxLng: Math.min(180, b.maxLng + dLng),
  };
}

function contains(outer: BoundingBox, inner: BoundingBox): boolean {
  return (
    inner.minLat >= outer.minLat && inner.maxLat <= outer.maxLat && inner.minLng >= outer.minLng && inner.maxLng <= outer.maxLng
  );
}

// Loads only the reports inside the current map viewport (never the whole
// world), refetching as the map moves: debounced, cancelling stale requests,
// and reusing the last fetched region while it's still fresh.
export function useViewportReports(viewport: Viewport | null, filters: MapFilters) {
  const { t } = useTranslation();
  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const lastRegion = useRef<{ bbox: BoundingBox; key: string; at: number } | null>(null);
  const viewportRef = useRef(viewport);
  const filtersRef = useRef(filters);
  useEffect(() => {
    viewportRef.current = viewport;
    filtersRef.current = filters;
  });

  // Only the server-side parts of the filters decide whether to refetch.
  const filterKey = JSON.stringify([filters.types, filters.severities, filters.activeOnly, filters.updatedWithinMin]);

  const load = useCallback(
    async (force: boolean) => {
      const vp = viewportRef.current;
      if (!vp) return;
      const last = lastRegion.current;
      if (!force && last && last.key === filterKey && Date.now() - last.at < REGION_MAX_AGE_MS && contains(last.bbox, vp.bbox)) {
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const region = pad(vp.bbox);

      setRefreshing(true);
      setStatus((s) => (s === "ready" ? s : "loading"));
      try {
        const res = await reportsService.list({ ...toListQuery(filtersRef.current), bbox: region }, controller.signal);
        lastRegion.current = { bbox: region, key: filterKey, at: Date.now() };
        setReports(res.reports);
        setHasMore(res.has_more);
        setStatus("ready");
        setErrorMessage(null);
      } catch (err) {
        if (isAbortError(err)) return;
        setStatus("error");
        setErrorMessage(err instanceof ApiError && err.status !== 0 ? err.message : t("failedLoadReports"));
      } finally {
        if (abortRef.current === controller) setRefreshing(false);
      }
    },
    [filterKey, t],
  );

  useEffect(() => {
    if (!viewport) return;
    const timer = setTimeout(() => load(false), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [viewport, load]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Applies a report returned by a mutation (create/confirm) without a
  // refetch; reports that are no longer open drop off the map.
  const upsertReport = useCallback((updated: Report) => {
    setReports((prev) => {
      const without = prev.filter((r) => r.id !== updated.id);
      return isOpen(updated.status) ? [updated, ...without] : without;
    });
  }, []);

  const reload = useCallback(() => load(true), [load]);

  return { reports, status, refreshing, hasMore, errorMessage, reload, upsertReport };
}
