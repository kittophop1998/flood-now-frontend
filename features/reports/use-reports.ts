"use client";

import { useCallback, useEffect, useState } from "react";
import { reportsService } from "@/services/reports-service";
import { ApiError } from "@/services/api-client";
import type { Report } from "@/types/report";

const POLL_INTERVAL_MS = 60_000;

export function useReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await reportsService.list();
      setReports(data);
      setStatus("ready");
      setErrorMessage(null);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof ApiError ? err.message : "Failed to load reports.");
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const upsertReport = useCallback((updated: Report) => {
    setReports((prev) => {
      const exists = prev.some((r) => r.id === updated.id);
      return exists ? prev.map((r) => (r.id === updated.id ? updated : r)) : [updated, ...prev];
    });
  }, []);

  return { reports, status, errorMessage, reload: load, upsertReport };
}
