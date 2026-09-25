"use client";

import { useCallback, useEffect, useState } from "react";
import { savedPlacesService } from "@/services/community-service";
import { ApiError, isAbortError } from "@/services/api-client";
import { getDeviceId } from "@/lib/device-id";
import { readCache, writeCache } from "@/lib/offline-cache";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { SavedPlace, SavedPlaceInput } from "@/types/community";

const CACHE_KEY = "saved-places";

// This device's saved places with their watch-area status. The last list is
// kept for offline use and flagged with when it was fetched.
export function useSavedPlaces() {
  const { t } = useTranslation();
  const [places, setPlaces] = useState<SavedPlace[]>(() => readCache<SavedPlace[]>(CACHE_KEY)?.data ?? []);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  // Set when showing the cached copy because the network failed.
  const [staleSince, setStaleSince] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const list = await savedPlacesService.list(getDeviceId(), signal);
      setPlaces(list);
      writeCache(CACHE_KEY, list);
      setStaleSince(null);
      setStatus("ready");
    } catch (err) {
      if (isAbortError(err)) return;
      const cached = readCache<SavedPlace[]>(CACHE_KEY);
      if (cached) {
        setPlaces(cached.data);
        setStaleSince(cached.savedAt);
        setStatus("ready");
      } else {
        setStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      setActionError(null);
      try {
        await action();
        await load();
        return true;
      } catch (err) {
        setActionError(err instanceof ApiError && err.status !== 0 ? err.message : t("placeSaveFailed"));
        return false;
      }
    },
    [load, t],
  );

  const create = useCallback(
    (input: Omit<SavedPlaceInput, "device_id">) => run(() => savedPlacesService.create({ ...input, device_id: getDeviceId() })),
    [run],
  );
  const update = useCallback(
    (id: string, input: Omit<SavedPlaceInput, "device_id">) =>
      run(() => savedPlacesService.update(id, { ...input, device_id: getDeviceId() })),
    [run],
  );
  const remove = useCallback((id: string) => run(() => savedPlacesService.remove(getDeviceId(), id)), [run]);

  return { places, status, staleSince, actionError, reload: () => load(), create, update, remove };
}

export type SavedPlacesApi = ReturnType<typeof useSavedPlaces>;
