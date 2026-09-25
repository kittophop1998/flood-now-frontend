"use client";

import { useState } from "react";
import { reportsService } from "@/services/reports-service";
import { ApiError } from "@/services/api-client";
import { getDeviceId } from "@/lib/device-id";
import type { ConfirmationStatus, Report } from "@/types/report";

export function useConfirmReport() {
  const [pendingStatus, setPendingStatus] = useState<ConfirmationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirm(reportId: string, status: ConfirmationStatus): Promise<Report | null> {
    setPendingStatus(status);
    setError(null);
    try {
      return await reportsService.confirm(reportId, { device_id: getDeviceId(), status });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to confirm report.");
      return null;
    } finally {
      setPendingStatus(null);
    }
  }

  return { confirm, pendingStatus, error };
}
