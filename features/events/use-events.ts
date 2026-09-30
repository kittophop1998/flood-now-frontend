"use client";

import { useCallback, useState } from "react";
import { eventsService } from "@/services/community-service";
import { ApiError } from "@/services/api-client";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { CommunityEvent, EventInput } from "@/types/community";

// Organizer actions on one of your own events, from its map popup (the API
// authorizes every write: session + organizer only).
export function useManageEvent() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | null> => {
      setError(null);
      try {
        return await action();
      } catch (err) {
        setError(err instanceof ApiError && err.status !== 0 ? err.message : t("eventSaveFailed"));
        return null;
      }
    },
    [t],
  );
  return {
    error,
    update: (id: string, input: EventInput) => run(() => eventsService.update(id, input)),
    cancel: (id: string) => run(() => eventsService.cancel(id)),
    remove: (id: string) =>
      run(async () => {
        await eventsService.remove(id);
        return true;
      }),
  };
}

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
