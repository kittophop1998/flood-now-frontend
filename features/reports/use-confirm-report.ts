"use client";

import { useRef, useState } from "react";
import { reportsService } from "@/services/reports-service";
import { ApiError } from "@/services/api-client";
import { getDeviceId } from "@/lib/device-id";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { ConditionUpdate, ConfirmationStatus, Report } from "@/types/report";

export function useConfirmReport() {
  const { t } = useTranslation();
  const [pendingStatus, setPendingStatus] = useState<ConfirmationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  // pendingStatus only disables the buttons after a re-render; the ref also
  // drops a second tap that lands before that render happens.
  const inFlight = useRef(false);

  // `condition` (still_active only) also updates what the report shows.
  async function confirm(reportId: string, status: ConfirmationStatus, condition: ConditionUpdate = {}): Promise<Report | null> {
    if (inFlight.current) return null;
    inFlight.current = true;
    setPendingStatus(status);
    setError(null);
    try {
      return await reportsService.confirm(reportId, { ...condition, device_id: getDeviceId(), status });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedConfirmReport"));
      return null;
    } finally {
      inFlight.current = false;
      setPendingStatus(null);
    }
  }

  return { confirm, pendingStatus, error };
}
