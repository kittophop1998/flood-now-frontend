"use client";

import { useCallback, useEffect, useState } from "react";
import { providerService, serviceRequestsService } from "@/services/local-services-service";
import { ApiError, isAbortError } from "@/services/api-client";
import { forgetTopup, recalledTopup, rememberTopup } from "@/lib/pending-topup";
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

// The provider's credit wallet and the PromptPay top-up on screen. A
// shown QR is polled until the Stripe webhook has decided (paid, or
// failed/expired) — nothing on this side ever marks it paid.
export function useWallet(enabled: boolean) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  // The top-up whose QR is shown (pending), or its outcome.
  const [payment, setPayment] = useState<Topup | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

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
    // A QR shown before the app was left/reloaded: bring back its result
    // (or the QR itself if still unpaid). 404 = not this account's → forget.
    const remembered = recalledTopup();
    if (remembered) {
      providerService
        .topup(remembered, controller.signal)
        .then((t) => setPayment((cur) => cur ?? t))
        .catch((err) => {
          if (err instanceof ApiError && err.status === 404) forgetTopup();
        });
    }
    return () => controller.abort();
  }, [enabled, load]);

  const paymentId = payment?.id ?? null;
  const waiting = payment?.status === "pending";
  useEffect(() => {
    if (!paymentId || !waiting) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const t = await providerService.topup(paymentId);
        if (stopped) return;
        if (t.status !== "pending") {
          setPayment(t);
          await load();
          return;
        }
      } catch {
        // offline blip: keep polling
      }
      if (!stopped) timer = setTimeout(poll, 3000);
    };
    timer = setTimeout(poll, 3000);
    // Coming back from the banking app: check right away.
    const onVisible = () => {
      if (document.visibilityState !== "visible" || stopped) return;
      clearTimeout(timer);
      poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [paymentId, waiting, load]);

  const startTopup = useCallback(
    async (packageId: string) => {
      setStartError(null);
      setStarting(true);
      try {
        const t = await providerService.startTopup(packageId);
        rememberTopup(t.id);
        setPayment(t);
        load();
      } catch (err) {
        setStartError(apiMessage(err) ?? "network");
      } finally {
        setStarting(false);
      }
    },
    [load],
  );

  return {
    wallet,
    status,
    reload: () => load(),
    payment,
    // Show an unpaid QR again (from the top-up history).
    resume: (t: Topup) => {
      rememberTopup(t.id);
      setPayment(t);
    },
    // Done / cancel: the result has been seen, stop remembering it.
    closePayment: () => {
      forgetTopup();
      setPayment(null);
    },
    startTopup,
    starting,
    startError,
  };
}
