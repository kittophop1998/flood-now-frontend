"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { providersService, serviceRequestsService } from "@/services/local-services-service";
import { ApiError, isAbortError } from "@/services/api-client";
import { newClientId } from "@/lib/outbox";
import { isClosedStatus } from "@/lib/service-meta";
import type { LatLng } from "@/types/community";
import type { CancelReason, CreateServiceRequestInput, IssueReason, ServiceCategory, ServiceProvider, ServiceRequest, ServiceRequestStatus } from "@/types/local-services";

const POLL_MS = 15_000;

function apiMessage(err: unknown): string | null {
  return err instanceof ApiError && err.status !== 0 ? err.message : null;
}

export interface ProviderFilters {
  category: ServiceCategory | null;
  q: string;
  availableOnly: boolean;
}

// Public provider browse around `at` (the user, or the map center).
export function useProviders(at: LatLng | null, filters: ProviderFilters, enabled = true) {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [attempt, setAttempt] = useState(0);
  const lat = at?.latitude;
  const lng = at?.longitude;

  useEffect(() => {
    if (!enabled || lat == null || lng == null) return;
    const controller = new AbortController();
    setStatus("loading");
    providersService
      .list({ at: { latitude: lat, longitude: lng }, category: filters.category, q: filters.q, availableOnly: filters.availableOnly }, controller.signal)
      .then((list) => {
        setProviders(list);
        setStatus("ready");
      })
      .catch((err) => {
        if (!isAbortError(err)) setStatus("error");
      });
    return () => controller.abort();
  }, [enabled, lat, lng, filters.category, filters.q, filters.availableOnly, attempt]);

  return { providers, status, retry: () => setAttempt((n) => n + 1) };
}

// The signed-in customer's service requests. Polled while `watching` (the
// services screen is open) or a request is still in progress.
export function useMyServiceRequests(signedIn: boolean, watching: boolean) {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  // One idempotency key per form submission, reused across retries.
  const pendingClientId = useRef<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!signedIn) return;
      try {
        setRequests(await serviceRequestsService.mine(signal));
        setStatus("ready");
      } catch (err) {
        if (!isAbortError(err)) setStatus((s) => (s === "ready" ? s : "error"));
      }
    },
    [signedIn],
  );

  useEffect(() => {
    if (!signedIn) {
      setRequests([]);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    setStatus((s) => (s === "ready" ? s : "loading"));
    load(controller.signal);
    return () => controller.abort();
  }, [signedIn, load]);

  const inProgress = requests.some((r) => !isClosedStatus(r.status));
  useEffect(() => {
    if (!signedIn || (!watching && !inProgress)) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [signedIn, watching, inProgress, load]);

  const run = useCallback(
    async (fn: () => Promise<unknown>): Promise<boolean> => {
      setActionError(null);
      try {
        await fn();
        await load();
        return true;
      } catch (err) {
        setActionError(apiMessage(err));
        await load();
        return false;
      }
    },
    [load],
  );

  const create = useCallback(
    async (input: Omit<CreateServiceRequestInput, "client_id">): Promise<ServiceRequest | string> => {
      pendingClientId.current ??= newClientId();
      try {
        const created = await serviceRequestsService.create({ ...input, client_id: pendingClientId.current });
        pendingClientId.current = null;
        // Show it right away: when a guest signed in to send it, this
        // callback is from before sign-in, and the list refresh that sign-in
        // triggered may have run before the request existed.
        setRequests((rs) => [created, ...rs.filter((r) => r.id !== created.id)]);
        setStatus("ready");
        await load();
        return created;
      } catch (err) {
        return apiMessage(err) ?? "network";
      }
    },
    [load],
  );

  return {
    requests,
    active: requests.filter((r) => !isClosedStatus(r.status)),
    history: requests.filter((r) => isClosedStatus(r.status)).slice(0, 5),
    status,
    actionError,
    clearActionError: () => setActionError(null),
    reload: () => load(),
    create,
    selectOffer: (id: string, offerId: string) => run(() => serviceRequestsService.selectOffer(id, offerId)),
    setStatus: (id: string, s: ServiceRequestStatus) => run(() => serviceRequestsService.setStatus(id, s)),
    cancel: (id: string, reason: CancelReason, note?: string) => run(() => serviceRequestsService.cancel(id, reason, note)),
    reportIssue: (id: string, reason: IssueReason, details?: string) => run(() => serviceRequestsService.reportIssue(id, reason, details)),
  };
}

export type CustomerServicesApi = ReturnType<typeof useMyServiceRequests>;
