"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sosService } from "@/services/community-service";
import { ApiError, isAbortError } from "@/services/api-client";
import { getDeviceId } from "@/lib/device-id";
import { newClientId } from "@/lib/outbox";
import type { CreateSosInput, SosRequest, SosStatus } from "@/types/community";

const POLL_MS = 15_000;

export type SendState =
  | { status: "idle" }
  | { status: "sending" }
  // The request did not reach the server. Never shown as "sent".
  | { status: "not_sent"; offline: boolean; message?: string };

// SOS requests this device made or is helping with. Creating one requires
// the network: there is no offline queue for SOS, so a failure is surfaced
// as "not sent" instead of silently waiting. Status is polled only while
// `watching` (an SOS/helper screen is open) or the device has an open
// request, so idle users don't poll at all.
export function useSos(watching: boolean) {
  const [requests, setRequests] = useState<SosRequest[]>([]);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [send, setSend] = useState<SendState>({ status: "idle" });
  const [actionError, setActionError] = useState<string | null>(null);
  // One client id per attempt, so a retry after a lost response can't
  // create a second request.
  const pendingClientId = useRef<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setRequests(await sosService.mine(getDeviceId(), signal));
      setLoadStatus("ready");
    } catch (err) {
      if (!isAbortError(err)) setLoadStatus((s) => (s === "ready" ? s : "error"));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const hasOpen = requests.some((r) => r.status !== "completed" && r.status !== "cancelled");
  useEffect(() => {
    if (!watching && !hasOpen) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [load, watching, hasOpen]);

  const create = useCallback(
    async (input: Omit<CreateSosInput, "device_id" | "client_id">): Promise<SosRequest | null> => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setSend({ status: "not_sent", offline: true });
        return null;
      }
      pendingClientId.current ??= newClientId();
      setSend({ status: "sending" });
      try {
        const created = await sosService.create({ ...input, device_id: getDeviceId(), client_id: pendingClientId.current });
        pendingClientId.current = null;
        setSend({ status: "idle" });
        await load();
        return created;
      } catch (err) {
        const offline = err instanceof ApiError && err.status === 0;
        setSend({ status: "not_sent", offline, message: err instanceof ApiError && !offline ? err.message : undefined });
        return null;
      }
    },
    [load],
  );

  const setStatus = useCallback(
    async (id: string, status: SosStatus): Promise<boolean> => {
      setActionError(null);
      try {
        await sosService.setStatus(getDeviceId(), id, status);
        await load();
        return true;
      } catch (err) {
        setActionError(err instanceof ApiError && err.status !== 0 ? err.message : null);
        await load();
        return false;
      }
    },
    [load],
  );

  const accept = useCallback(
    async (id: string): Promise<boolean> => {
      setActionError(null);
      try {
        await sosService.accept(getDeviceId(), id);
        await load();
        return true;
      } catch (err) {
        setActionError(err instanceof ApiError && err.status !== 0 ? err.message : null);
        return false;
      }
    },
    [load],
  );

  const mine = requests.filter((r) => r.role === "requester");
  const assignments = requests.filter((r) => r.role === "helper");
  const active = mine.find((r) => r.status !== "completed" && r.status !== "cancelled") ?? null;

  return {
    requests,
    mine,
    active,
    assignments,
    loadStatus,
    send,
    resetSend: () => setSend({ status: "idle" }),
    actionError,
    clearActionError: () => setActionError(null),
    create,
    setStatus,
    accept,
    reload: () => load(),
  };
}

export type SosApi = ReturnType<typeof useSos>;
