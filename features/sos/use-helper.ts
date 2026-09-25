"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { helpersService } from "@/services/community-service";
import { ApiError, isAbortError } from "@/services/api-client";
import { getDeviceId } from "@/lib/device-id";
import { readCache, writeCache } from "@/lib/offline-cache";
import type { HelperInput, HelperProfile, LatLng, NearbySos } from "@/types/community";

const CACHE_KEY = "helper-profile";
const POLL_MS = 30_000;

// This device's helper-mode profile plus, while active, the waiting SOS
// requests it can answer from `location`.
export function useHelper(location: LatLng | null) {
  const [profile, setProfile] = useState<HelperProfile | null>(() => readCache<HelperProfile | null>(CACHE_KEY)?.data ?? null);
  const [profileStatus, setProfileStatus] = useState<"loading" | "ready" | "error">("loading");
  const [nearby, setNearby] = useState<NearbySos[]>([]);
  const [nearbyStatus, setNearbyStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    helpersService
      .me(getDeviceId(), controller.signal)
      .then((p) => {
        setProfile(p);
        writeCache(CACHE_KEY, p);
        setProfileStatus("ready");
      })
      .catch((err) => {
        if (!isAbortError(err)) setProfileStatus("error");
      });
    return () => controller.abort();
  }, []);

  const lat = location?.latitude;
  const lng = location?.longitude;
  const loadNearby = useCallback(async () => {
    if (lat == null || lng == null || !profile?.active) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setNearbyStatus((s) => (s === "ready" ? s : "loading"));
    try {
      setNearby(await helpersService.nearbySos(getDeviceId(), { latitude: lat, longitude: lng }, controller.signal));
      setNearbyStatus("ready");
    } catch (err) {
      if (!isAbortError(err)) setNearbyStatus("error");
    }
  }, [lat, lng, profile?.active]);

  useEffect(() => {
    if (!profile?.active) return;
    const first = setTimeout(loadNearby, 0);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") loadNearby();
    }, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [loadNearby, profile?.active]);

  const save = useCallback(
    async (input: Omit<HelperInput, "device_id">): Promise<boolean> => {
      setSaving(true);
      setSaveError(null);
      try {
        const next = await helpersService.save({ ...input, device_id: getDeviceId() });
        setProfile(next);
        writeCache(CACHE_KEY, next);
        return true;
      } catch (err) {
        setSaveError(err instanceof ApiError && err.status !== 0 ? err.message : null);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return {
    profile,
    profileStatus,
    nearby: profile?.active ? nearby : [],
    nearbyStatus: profile?.active ? nearbyStatus : ("idle" as const),
    reloadNearby: loadNearby,
    save,
    saving,
    saveError,
  };
}
