"use client";

import { useEffect, useState } from "react";
import { reportsService } from "@/services/reports-service";
import { placesService } from "@/services/places-service";
import { isAbortError } from "@/services/api-client";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { NearbySort, Place, Report, ReportType } from "@/types/report";

type LatLng = { latitude: number; longitude: number };
type LookupStatus = "idle" | "loading" | "ready" | "error";

// Shared shape for "fetch something about a point, debounced, cancelling the
// previous request when the point changes".
function usePointLookup<T>(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
  debounceMs: number,
  initial: T,
) {
  const [result, setResult] = useState<{ key: string | null; data: T; status: LookupStatus }>({
    key: null,
    data: initial,
    status: "idle",
  });
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (key == null) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setResult((r) => ({ ...r, status: "loading" }));
      try {
        const data = await fetcher(controller.signal);
        setResult({ key, data, status: "ready" });
      } catch (err) {
        if (!isAbortError(err)) setResult({ key, data: initial, status: "error" });
      }
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // fetcher/initial are recreated each render; `key` captures their inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retryToken, debounceMs]);

  const current = key != null && result.key === key;
  return {
    data: current ? result.data : initial,
    status: key == null ? ("idle" as const) : current ? result.status : ("loading" as const),
    retry: () => setRetryToken((n) => n + 1),
  };
}

const NO_REPORTS: Report[] = [];

// Likely duplicates of a report about to be created (same category, within
// the category's server-side radius).
export function useDuplicateReports(point: LatLng | null, type: ReportType | null | undefined) {
  const key = point && type ? `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)},${type}` : null;
  return usePointLookup(
    key,
    (signal) => reportsService.duplicates(point!.latitude, point!.longitude, type!, signal),
    250,
    NO_REPORTS,
  );
}

// Open reports around a point: the Nearby view and the location picker.
export function useNearbyReports(point: LatLng | null, sort: NearbySort, radiusM: number) {
  const key = point ? `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)},${sort},${radiusM}` : null;
  return usePointLookup(
    key,
    (signal) => reportsService.nearby({ latitude: point!.latitude, longitude: point!.longitude, sort, radiusM }, signal),
    300,
    NO_REPORTS,
  );
}

// Approximate street address for a point. Rounded to ~11 m so small pin
// moves reuse the same lookup; failures just mean "no address shown".
export function useApproximateAddress(point: LatLng | null) {
  const { locale } = useTranslation();
  const key = point ? `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)},${locale}` : null;
  const { data, status } = usePointLookup<Place | null>(
    key,
    (signal) => placesService.reverse(point!.latitude, point!.longitude, locale, signal),
    600,
    null,
  );
  return { place: data, status };
}
