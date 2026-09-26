"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { officialFloodService } from "@/services/community-service";
import { isAbortError } from "@/services/api-client";
import { readCache, writeCache } from "@/lib/offline-cache";
import {
  FLOOD_CACHE_MAX_POSITIONS,
  canReuseFloodRegion,
  countFloodPositions,
  floodCacheKey,
  padFloodBBox,
  type FetchedFloodRegion,
} from "@/lib/official-flood";
import type { Viewport } from "@/features/reports/use-viewport-reports";
import type { FloodLayer, GistdaPeriod } from "@/types/community";

const DEBOUNCE_MS = 400;

export type FloodLayerStatus = "idle" | "loading" | "ready" | "error";

// The official GISTDA flood layer for the current viewport. Nothing is
// requested until the layer is switched on; after that each period's copy is
// kept and reused while the map moves inside it (the API caches GISTDA
// itself, so even a refetch never reaches the provider per pan). Stale
// requests are cancelled when the view or period changes. If a request
// fails, whatever copy exists (this session's, or the device's last one) is
// kept on screen and marked not current.
export function useGistdaFlood(viewport: Viewport | null, enabled: boolean, period: GistdaPeriod) {
  const [layer, setLayer] = useState<FloodLayer | null>(null);
  const [status, setStatus] = useState<FloodLayerStatus>("idle");
  const [attempt, setAttempt] = useState(0);
  const memo = useRef(new Map<GistdaPeriod, { region: FetchedFloodRegion; layer: FloodLayer }>());
  const layerRef = useRef<FloodLayer | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const show = useCallback((next: FloodLayer | null) => {
    layerRef.current = next;
    setLayer(next);
  }, []);

  useEffect(() => {
    if (!enabled || !viewport) return;
    const hit = memo.current.get(period);
    const reuse = hit != null && canReuseFloodRegion(hit.region, viewport, Date.now());
    const timer = setTimeout(
      async () => {
        abortRef.current?.abort();
        if (reuse) {
          show(hit.layer);
          setStatus("ready");
          return;
        }
        const controller = new AbortController();
        abortRef.current = controller;
        const bbox = padFloodBBox(viewport.bbox);
        setStatus("loading");
        try {
          const res = await officialFloodService.get({ period, bbox }, controller.signal);
          memo.current.set(period, { region: { bbox, zoom: viewport.zoom, at: Date.now() }, layer: res });
          show(res);
          setStatus("ready");
          if (countFloodPositions(res) <= FLOOD_CACHE_MAX_POSITIONS) writeCache(floodCacheKey(period), res);
        } catch (err) {
          if (isAbortError(err)) return;
          if (layerRef.current?.period !== period) show(readCache<FloodLayer>(floodCacheKey(period))?.data ?? null);
          setStatus("error");
        }
      },
      reuse ? 0 : DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [viewport, enabled, period, attempt, show]);

  useEffect(() => {
    if (enabled) return;
    abortRef.current?.abort();
  }, [enabled]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const retry = useCallback(() => {
    memo.current.delete(period);
    setAttempt((n) => n + 1);
  }, [period]);

  const current = enabled && layer?.period === period ? layer : null;
  return {
    layer: current,
    status: enabled ? status : ("idle" as const),
    // Not live: the API served its last good copy, or this request failed
    // and an older copy is on screen.
    stale: current != null && (current.stale || status === "error"),
    retry,
  };
}
