"use client";

import { useCallback, useRef, useState } from "react";
import { routesService } from "@/services/community-service";
import { ApiError, isAbortError } from "@/services/api-client";
import type { LatLng, RouteEvaluation } from "@/types/community";
import type { Vehicle } from "@/types/report";

export type RouteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: RouteEvaluation }
  | { status: "error"; kind: "unavailable" | "offline" | "invalid" | "other"; message?: string };

// Asks the API to score candidate routes for a vehicle; a newer request
// cancels the previous one.
export function useRouteEvaluation() {
  const [state, setState] = useState<RouteState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const evaluate = useCallback(async (origin: LatLng, destination: LatLng, vehicle: Vehicle) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: "loading" });
    try {
      const result = await routesService.evaluate(origin, destination, vehicle, controller.signal);
      setState({ status: "ready", result });
    } catch (err) {
      if (isAbortError(err)) return;
      if (err instanceof ApiError) {
        if (err.status === 0) return setState({ status: "error", kind: "offline" });
        if (err.code === "UPSTREAM_UNAVAILABLE") return setState({ status: "error", kind: "unavailable" });
        if (err.code === "VALIDATION_ERROR") return setState({ status: "error", kind: "invalid", message: err.message });
      }
      setState({ status: "error", kind: "other" });
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: "idle" });
  }, []);

  return { state, evaluate, reset };
}
