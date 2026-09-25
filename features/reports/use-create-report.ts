"use client";

import { useState } from "react";
import { reportsService } from "@/services/reports-service";
import { uploadReportImage } from "@/services/uploads-service";
import { compressReportImage } from "@/lib/image-compression";
import { ApiError } from "@/services/api-client";
import type { CreateReportInput, Report } from "@/types/report";

export function useCreateReport() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(input: Omit<CreateReportInput, "image_key">, imageFile: File | null): Promise<Report | null> {
    setSubmitting(true);
    setError(null);
    try {
      let imageKey: string | null = null;
      if (imageFile) {
        const compressed = await compressReportImage(imageFile);
        imageKey = await uploadReportImage(compressed);
      }
      return await reportsService.create({ ...input, image_key: imageKey });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create report.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  return { submit, submitting, error };
}
