"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { reportsService } from "@/services/reports-service";
import { ApiError, isNetworkError } from "@/services/api-client";
import { getDeviceId } from "@/lib/device-id";
import { setConfirmation } from "@/lib/confirmed-reports";
import { applySyncResult, enqueue, newClientId, readOutbox, writeOutbox, type OutboxItem } from "@/lib/outbox";
import type { ConfirmationStatus, CreateReportInput, Report } from "@/types/report";

const RETRY_INTERVAL_MS = 30_000;

// Queued reports/votes made while offline, synced when the network returns.
// `onSynced` receives each report the server accepted so the map can show it.
export function useOutbox(onSynced: (report: Report) => void) {
  const [items, setItems] = useState<OutboxItem[]>(() => readOutbox());
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const onSyncedRef = useRef(onSynced);
  useEffect(() => {
    onSyncedRef.current = onSynced;
  });

  const update = useCallback((fn: (items: OutboxItem[]) => OutboxItem[]) => {
    setItems((prev) => {
      const next = fn(prev);
      writeOutbox(next);
      return next;
    });
  }, []);

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    const pending = readOutbox().filter((i) => i.status === "pending");
    if (pending.length === 0) return;
    syncingRef.current = true;
    setSyncing(true);
    for (const item of pending) {
      try {
        const report =
          item.kind === "report"
            ? await reportsService.create({ ...item.payload, client_id: item.id })
            : await reportsService.confirm(item.reportId, { device_id: getDeviceId(), status: item.payload.status });
        if (item.kind === "confirm") setConfirmation(item.reportId, item.payload.status);
        update((all) => applySyncResult(all, item.id, { ok: true }));
        onSyncedRef.current(report);
      } catch (err) {
        const retryable = isNetworkError(err) || (err instanceof ApiError && err.status >= 500);
        update((all) =>
          applySyncResult(all, item.id, { ok: false, retryable, error: err instanceof ApiError ? err.message : String(err) }),
        );
        if (retryable) break; // still offline: stop and try again later
      }
    }
    syncingRef.current = false;
    setSyncing(false);
  }, [update]);

  useEffect(() => {
    sync();
    const onOnline = () => sync();
    window.addEventListener("online", onOnline);
    const interval = setInterval(() => {
      if (navigator.onLine) sync();
    }, RETRY_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(interval);
    };
  }, [sync]);

  const queueReport = useCallback(
    (payload: CreateReportInput) => {
      const id = payload.client_id ?? newClientId();
      update((all) =>
        enqueue(all, { id, kind: "report", payload: { ...payload, client_id: id }, createdAt: new Date().toISOString(), attempts: 0, status: "pending" }),
      );
    },
    [update],
  );

  const queueConfirm = useCallback(
    (reportId: string, status: ConfirmationStatus) => {
      update((all) =>
        enqueue(all, { id: newClientId(), kind: "confirm", reportId, payload: { status }, createdAt: new Date().toISOString(), attempts: 0, status: "pending" }),
      );
    },
    [update],
  );

  const retry = useCallback(
    (id: string) => {
      update((all) => all.map((i) => (i.id === id ? { ...i, status: "pending" as const, error: undefined } : i)));
      setTimeout(() => sync(), 0);
    },
    [update, sync],
  );

  const discard = useCallback((id: string) => update((all) => all.filter((i) => i.id !== id)), [update]);

  return {
    items,
    pendingCount: items.filter((i) => i.status === "pending").length,
    failedCount: items.filter((i) => i.status === "failed").length,
    syncing,
    queueReport,
    queueConfirm,
    retry,
    discard,
    syncNow: sync,
  };
}

export type OutboxApi = ReturnType<typeof useOutbox>;
