"use client";

import { useState } from "react";
import { reportsService } from "@/services/reports-service";
import { ApiError } from "@/services/api-client";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { CreateReportInput, Report } from "@/types/report";

// Submits a report whose photo (if any) was already uploaded by
// useImageUpload, so a failed submit can be retried without re-uploading.
// Resolves to "network" when the request never reached the server, so the
// caller can queue it for later instead of losing it.
export function useCreateReport() {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(input: CreateReportInput): Promise<Report | "network" | null> {
    setSubmitting(true);
    setError(null);
    try {
      return await reportsService.create(input);
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) return "network";
      setError(err instanceof ApiError ? err.message : t("failedCreateReport"));
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  return { submit, submitting, error };
}
