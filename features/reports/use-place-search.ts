"use client";

import { useCallback, useRef, useState } from "react";
import { placesService } from "@/services/places-service";
import { isAbortError } from "@/services/api-client";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { BoundingBox, Place } from "@/types/report";

// Explicit (submit-to-search) place lookup. Deliberately not
// search-as-you-type: the default geocoder (public Nominatim) disallows
// autocomplete traffic.
export function usePlaceSearch() {
  const { locale } = useTranslation();
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async (query: string, near?: BoundingBox) => {
      const q = query.trim();
      if (q.length < 2) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading");
      try {
        setResults(await placesService.search(q, locale, near, controller.signal));
        setStatus("ready");
      } catch (err) {
        if (!isAbortError(err)) setStatus("error");
      }
    },
    [locale],
  );

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setResults([]);
    setStatus("idle");
  }, []);

  return { results, status, search, clear };
}
