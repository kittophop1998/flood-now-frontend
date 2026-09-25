import { z } from "zod";
import { REPORT_TYPES, SEVERITIES } from "@/types/report";
import type { TranslateFn } from "@/lib/i18n/locale";

// Client-side mirror of the validation rules in
// apps/api/internal/domain/report/report.go — kept close to the API's
// rules so the form fails fast before hitting the network.
export function createReportFormSchema(t: TranslateFn) {
  return z.object({
    type: z.enum(REPORT_TYPES, { message: t("chooseReportType") }),
    severity: z.enum(SEVERITIES, { message: t("chooseSeverity") }),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    water_level_cm: z.number().int().min(0).max(1000).nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    people_count: z.number().int().min(0).max(999).nullable().optional(),
    has_child: z.boolean().nullable().optional(),
    has_elderly: z.boolean().nullable().optional(),
    contact_phone: z.string().max(32).nullable().optional(),
  });
}

export type ReportFormValues = z.infer<ReturnType<typeof createReportFormSchema>>;

export const confirmationSchema = z.object({
  device_id: z.string().min(8).max(128),
  status: z.enum(["still_active", "cleared"]),
});

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateImageFile(file: File, t: TranslateFn): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return t("imageTypeError");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return t("imageSizeError");
  }
  return null;
}
