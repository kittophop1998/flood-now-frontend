"use client";

import { useRef, useState } from "react";
import { reportsService } from "@/services/reports-service";
import { ApiError } from "@/services/api-client";
import { getDeviceId } from "@/lib/device-id";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { ReactionType, Report } from "@/types/report";

// Mirrors features/reports/use-confirm-report.ts: one request at a time, the
// UI disabled while it runs. Reactions aren't offline-queued (lib/outbox.ts).
export function useReportReaction() {
  const { t } = useTranslation();
  // The chip that was tapped, for its spinner.
  const [pendingType, setPendingType] = useState<ReactionType | null>(null);
  const [error, setError] = useState<string | null>(null);
  // pendingType only disables the chips after a re-render; the ref also drops
  // a second tap that lands before that render happens.
  const inFlight = useRef(false);

  // Sends `next` as the device's reaction (null clears it). `tapped` is the
  // chip that triggered it. Returns the updated report, or null on failure or
  // when another request is still running.
  async function react(reportId: string, tapped: ReactionType, next: ReactionType | null): Promise<Report | null> {
    if (inFlight.current) return null;
    inFlight.current = true;
    setPendingType(tapped);
    setError(null);
    try {
      const deviceId = getDeviceId();
      return next
        ? await reportsService.react(reportId, { device_id: deviceId, type: next })
        : await reportsService.removeReaction(reportId, deviceId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedReaction"));
      return null;
    } finally {
      inFlight.current = false;
      setPendingType(null);
    }
  }

  return { react, pendingType, error };
}
