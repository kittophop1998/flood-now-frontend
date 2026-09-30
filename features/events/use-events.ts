"use client";

import { useCallback, useEffect, useState } from "react";
import { eventsService } from "@/services/community-service";
import { ApiError, isAbortError } from "@/services/api-client";
import { useAuth } from "@/features/auth/auth-provider";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { BoundingBox } from "@/types/report";
import type { CommunityEvent, EventInput } from "@/types/community";

// Public events around an area (the events screen's list), plus the signed-in
// user's own events and the owner actions. The API authorizes every write.
export function useEvents(bbox: BoundingBox | null) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [nearby, setNearby] = useState<CommunityEvent[]>([]);
  const [nearbyStatus, setNearbyStatus] = useState<"loading" | "ready" | "error">("loading");
  const [mine, setMine] = useState<CommunityEvent[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const bboxKey = bbox ? JSON.stringify(bbox) : "";

  useEffect(() => {
    const controller = new AbortController();
    setNearbyStatus((s) => (s === "ready" ? s : "loading"));
    eventsService
      .list({ bbox: bbox ?? undefined }, controller.signal)
      .then((list) => {
        setNearby(list);
        setNearbyStatus("ready");
      })
      .catch((err) => {
        if (!isAbortError(err)) setNearbyStatus("error");
      });
    return () => controller.abort();
    // bboxKey stands in for bbox.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bboxKey, version, userId]);

  useEffect(() => {
    if (!userId) {
      setMine([]);
      return;
    }
    const controller = new AbortController();
    eventsService
      .mine(controller.signal)
      .then(setMine)
      .catch(() => {});
    return () => controller.abort();
  }, [userId, version]);

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | null> => {
      setActionError(null);
      try {
        const out = await action();
        setVersion((v) => v + 1);
        return out;
      } catch (err) {
        setActionError(err instanceof ApiError && err.status !== 0 ? err.message : t("eventSaveFailed"));
        return null;
      }
    },
    [t],
  );

  return {
    nearby,
    nearbyStatus,
    mine,
    actionError,
    reload: () => setVersion((v) => v + 1),
    create: (input: EventInput) => run(() => eventsService.create(input)),
    update: (id: string, input: EventInput) => run(() => eventsService.update(id, input)),
    cancel: (id: string) => run(() => eventsService.cancel(id)),
    remove: (id: string) => run(async () => {
      await eventsService.remove(id);
      return true;
    }),
  };
}

export type EventsApi = ReturnType<typeof useEvents>;

// Posting a new event from the create-report drawer (the API requires a
// signed-in user; a guest never gets here — the category tile is locked).
export function useCreateEvent() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const create = useCallback(
    async (input: EventInput): Promise<CommunityEvent | null> => {
      setError(null);
      try {
        return await eventsService.create(input);
      } catch (err) {
        setError(err instanceof ApiError && err.status !== 0 ? err.message : t("eventSaveFailed"));
        return null;
      }
    },
    [t],
  );
  return { create, error, clearError: () => setError(null) };
}
