"use client";

import { useCallback, useEffect, useState } from "react";
import { providerService, serviceRequestsService } from "@/services/local-services-service";
import { ApiError, isAbortError } from "@/services/api-client";
import type {
  CancelReason,
  IssueReason,
  MyProvider,
  OfferInput,
  ProviderInput,
  ProviderJob,
  ProviderOffer,
  RedactedRequest,
  ServiceRequestStatus,
  Topup,
  Wallet,
} from "@/types/local-services";

const POLL_MS = 20_000;

function apiMessage(err: unknown): string | null {
  return err instanceof ApiError && err.status !== 0 ? err.message : null;
}

// The signed-in user's provider profile (null = none yet). Only asked for
// when local services are on and someone is signed in.
export function useMyProvider(enabled: boolean) {
  const [provider, setProvider] = useState<MyProvider | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setProvider(await providerService.me(signal));
      setStatus("ready");
    } catch (err) {
      if (!isAbortError(err)) setStatus((s) => (s === "ready" ? s : "error"));
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setProvider(null);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    setStatus((s) => (s === "ready" ? s : "loading"));
    load(controller.signal);
    return () => controller.abort();
  }, [enabled, load]);

  const save = useCallback(async (input: ProviderInput): Promise<string | null> => {
    try {
      setProvider(await providerService.save(input));
      setStatus("ready");
      return null;
    } catch (err) {
      return apiMessage(err) ?? "network";
    }
  }, []);

  const setAvailable = useCallback(
    async (available: boolean): Promise<boolean> => {
      try {
        await providerService.setAvailable(available);
        await load();
        return true;
      } catch {
        return false;
      }
    },
    [load],
  );

  return { provider, status, reload: () => load(), save, setAvailable };
}

export type AcceptResult = { ok: true } | { ok: false; insufficient?: { balance: number; required: number }; message: string | null };

// A provider's work: requests nearby, their offers and jobs. Polled while
// the dashboard is open.
export function useProviderWork(enabled: boolean, available: boolean) {
  const [requests, setRequests] = useState<RedactedRequest[]>([]);
  const [offers, setOffers] = useState<ProviderOffer[]>([]);
  const [jobs, setJobs] = useState<ProviderJob[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const [reqs, offs, js] = await Promise.all([
          available ? providerService.nearbyRequests(signal) : Promise.resolve([] as RedactedRequest[]),
          providerService.offers(signal),
          providerService.jobs(signal),
        ]);
        setRequests(reqs);
        setOffers(offs);
        setJobs(js);
        setStatus("ready");
      } catch (err) {
        if (!isAbortError(err)) setStatus((s) => (s === "ready" ? s : "error"));
      }
    },
    [available],
  );

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setStatus((s) => (s === "ready" ? s : "loading"));
    load(controller.signal);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [enabled, load]);

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

  const accept = useCallback(
    async (offerId: string): Promise<AcceptResult> => {
      setActionError(null);
      try {
        await providerService.accept(offerId);
        await load();
        return { ok: true };
      } catch (err) {
        await load();
        if (err instanceof ApiError && err.code === "INSUFFICIENT_CREDIT") {
          return {
            ok: false,
            insufficient: { balance: Number(err.fields?.balance ?? 0), required: Number(err.fields?.required ?? 0) },
            message: err.message,
          };
        }
        return { ok: false, message: apiMessage(err) };
      }
    },
    [load],
  );

  return {
    requests,
    offers,
    jobs,
    status,
    actionError,
    clearActionError: () => setActionError(null),
    reload: () => load(),
    sendOffer: (requestId: string, input: OfferInput) => run(() => providerService.sendOffer(requestId, input)),
    dismiss: (requestId: string) => run(() => providerService.dismiss(requestId)),
    accept,
    reject: (offerId: string) => run(() => providerService.reject(offerId)),
    setJobStatus: (requestId: string, s: ServiceRequestStatus) => run(() => serviceRequestsService.setStatus(requestId, s)),
    backOut: (requestId: string, reason: CancelReason) => run(() => serviceRequestsService.cancel(requestId, reason)),
    reportIssue: (requestId: string, reason: IssueReason) => run(() => serviceRequestsService.reportIssue(requestId, reason)),
  };
}

export type ProviderWorkApi = ReturnType<typeof useProviderWork>;

// The provider's credit wallet. After a Stripe redirect, `returnedTopupId`
// is polled until the webhook has marked it paid (or it failed) — the
// redirect itself proves nothing.
export function useWallet(enabled: boolean, returnedTopupId: string | null) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [returned, setReturned] = useState<Topup | null>(null);
  const [confirming, setConfirming] = useState(returnedTopupId != null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setWallet(await providerService.wallet(signal));
      setStatus("ready");
    } catch (err) {
      if (!isAbortError(err)) setStatus((s) => (s === "ready" ? s : "error"));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setStatus((s) => (s === "ready" ? s : "loading"));
    load(controller.signal);
    return () => controller.abort();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || !returnedTopupId) return;
    let stopped = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      tries++;
      try {
        const t = await providerService.topup(returnedTopupId);
        if (stopped) return;
        setReturned(t);
        if (t.status !== "pending" || tries >= 40) {
          setConfirming(false);
          await load();
          return;
        }
      } catch {
        if (tries >= 40) {
          setConfirming(false);
          return;
        }
      }
      if (!stopped) timer = setTimeout(poll, 3000);
    };
    timer = setTimeout(poll, 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [enabled, returnedTopupId, load]);

  const startTopup = useCallback(async (packageId: string) => {
    setStartError(null);
    setStarting(packageId);
    try {
      const { checkout_url } = await providerService.startTopup(packageId);
      // Off to Stripe's hosted checkout; we come back to /?topup=<id>.
      window.location.assign(checkout_url);
    } catch (err) {
      setStartError(apiMessage(err) ?? "network");
      setStarting(null);
    }
  }, []);

  return { wallet, status, reload: () => load(), returned, confirming, startTopup, starting, startError };
}
