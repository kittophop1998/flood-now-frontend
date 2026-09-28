"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { savedPlacesService } from "@/services/community-service";
import { ApiError, isAbortError } from "@/services/api-client";
import { readCache, removeCache, writeCache } from "@/lib/offline-cache";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { SavedPlace, SavedPlaceInput } from "@/types/community";

// Offline copies are per account; the pre-accounts per-device copy is dropped.
const cacheKey = (userId: string) => `saved-places:${userId}`;
const LEGACY_CACHE_KEY = "saved-places";

// The signed-in user's private saved places with their watch-area status.
// Guests have none (status "guest": the screens ask them to sign in). The
// last list is kept for offline use, per account, flagged with when it was
// fetched.
export function useSavedPlaces() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [status, setStatus] = useState<"guest" | "loading" | "ready" | "error">("guest");
  // Set when showing the cached copy because the network failed.
  const [staleSince, setStaleSince] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!userId) return;
      try {
        const list = await savedPlacesService.list(signal);
        setPlaces(list);
        writeCache(cacheKey(userId), list);
        setStaleSince(null);
        setStatus("ready");
      } catch (err) {
        if (isAbortError(err)) return;
        const cached = readCache<SavedPlace[]>(cacheKey(userId));
        if (cached) {
          setPlaces(cached.data);
          setStaleSince(cached.savedAt);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      }
    },
    [userId],
  );

  useEffect(() => {
    removeCache(LEGACY_CACHE_KEY);
    setStaleSince(null);
    setActionError(null);
    if (!userId) {
      setPlaces([]);
      setStatus("guest");
      return;
    }
    setPlaces(readCache<SavedPlace[]>(cacheKey(userId))?.data ?? []);
    setStatus("loading");
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [userId, load]);

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

  const create = useCallback((input: SavedPlaceInput) => run(() => savedPlacesService.create(input)), [run]);
  const update = useCallback((id: string, input: SavedPlaceInput) => run(() => savedPlacesService.update(id, input)), [run]);
  const remove = useCallback((id: string) => run(() => savedPlacesService.remove(id)), [run]);

  return { places, status, staleSince, actionError, reload: () => load(), create, update, remove };
}

export type SavedPlacesApi = ReturnType<typeof useSavedPlaces>;
