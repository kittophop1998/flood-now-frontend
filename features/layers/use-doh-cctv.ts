"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cctvService } from "@/services/community-service";
import { isAbortError } from "@/services/api-client";
import { readCache, writeCache } from "@/lib/offline-cache";
import { padFloodBBox } from "@/lib/official-flood";
import { CCTV_AREA_LIMIT, CCTV_CACHE_KEY, CCTV_NEARBY_LIMIT, CCTV_NEARBY_RADIUS_M, canReuseCctvRegion, type FetchedCctvRegion } from "@/lib/cctv";
import type { Viewport } from "@/features/reports/use-viewport-reports";
import type { BoundingBox } from "@/types/report";
import type { CctvCamera, CctvLayer, LatLng } from "@/types/community";

const DEBOUNCE_MS = 400;

export type CctvLayerStatus = "idle" | "loading" | "ready" | "error";

// The official DOH camera layer for the current viewport. Nothing is
// requested until the layer is switched on; then a padded viewport is
// fetched after the map settles and reused while the map moves inside it
// (the API caches DOH itself, so no pan ever reaches DOH). Stale requests
// are cancelled. If a request fails, the last copy (this session's, or the
// device's) stays on screen marked not current.
export function useDohCctv(viewport: Viewport | null, enabled: boolean) {
  const [layer, setLayer] = useState<CctvLayer | null>(null);
  const [status, setStatus] = useState<CctvLayerStatus>("idle");
  const [attempt, setAttempt] = useState(0);
  const region = useRef<FetchedCctvRegion | null>(null);
  const layerRef = useRef<CctvLayer | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !viewport) return;
    const reuse = region.current != null && layerRef.current != null && canReuseCctvRegion(region.current, viewport.bbox, Date.now());
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      if (reuse) {
        setStatus("ready");
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      const bbox = padFloodBBox(viewport.bbox);
      setStatus("loading");
      try {
        const res = await cctvService.list({ bbox }, controller.signal);
        region.current = { bbox, at: Date.now() };
        layerRef.current = res;
        setLayer(res);
        setStatus("ready");
        writeCache(CCTV_CACHE_KEY, res);
      } catch (err) {
        if (isAbortError(err)) return;
        if (!layerRef.current) {
          layerRef.current = readCache<CctvLayer>(CCTV_CACHE_KEY)?.data ?? null;
          setLayer(layerRef.current);
        }
        setStatus("error");
      }
    }, reuse ? 0 : DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [viewport, enabled, attempt]);

  useEffect(() => {
    if (enabled) return;
    abortRef.current?.abort();
  }, [enabled]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const retry = useCallback(() => {
    region.current = null;
    setAttempt((n) => n + 1);
  }, []);

  const current = enabled ? layer : null;
  return {
    layer: current,
    cameras: current?.cameras ?? [],
    status: enabled ? status : ("idle" as const),
    // Not current: the API served its last good list, or this request
    // failed and an older copy is on screen.
    stale: current != null && (current.stale || status === "error"),
    retry,
  };
}

// Cameras near a point (an incident) or inside a box (a GISTDA area) — one
// small request when the detail opens, none when `enabled` is false. Any
// failure just means no section is shown.
export function useCctvNear(query: { at: LatLng } | { bbox: BoundingBox } | null, enabled: boolean): CctvCamera[] {
  const [result, setResult] = useState<{ key: string; cameras: CctvCamera[] } | null>(null);
  const key = query ? JSON.stringify(query) : null;
  useEffect(() => {
    if (!enabled || !key) return;
    const q = JSON.parse(key) as { at: LatLng } | { bbox: BoundingBox };
    const controller = new AbortController();
    const req =
      "at" in q
        ? cctvService.nearby({ at: q.at, radiusM: CCTV_NEARBY_RADIUS_M, limit: CCTV_NEARBY_LIMIT }, controller.signal)
        : cctvService.list({ bbox: q.bbox, limit: CCTV_AREA_LIMIT }, controller.signal);
    req.then((r) => setResult({ key, cameras: r.cameras })).catch(() => setResult({ key, cameras: [] }));
    return () => controller.abort();
  }, [key, enabled]);
  return enabled && result && result.key === key ? result.cameras : [];
}
