import { z } from "zod";
import { PASS_LEVELS, REPORT_TYPES, SEVERITIES, WATER_DEPTHS } from "@/types/report";
import type { TranslateFn } from "@/lib/i18n/locale";

const passLevel = z.enum(PASS_LEVELS);

// Client-side mirror of the validation rules in
// apps/api/internal/domain/report/report.go — kept close to the API's
// rules so the form fails fast before hitting the network.
export function createReportFormSchema(t: TranslateFn) {
  return z.object({
    type: z.enum(REPORT_TYPES, { message: t("chooseReportType") }),
    severity: z.enum(SEVERITIES, { message: t("chooseSeverity") }),
    water_depth: z.enum(WATER_DEPTHS).nullable().optional(),
    passability: z
      .object({ walk: passLevel, motorcycle: passLevel, sedan: passLevel, suv_pickup: passLevel })
      .nullable()
      .optional(),
    description: z.string().max(2000, t("descriptionTooLong")).nullable().optional(),
    people_count: z.number().int().min(0).max(999).nullable().optional(),
    has_child: z.boolean().nullable().optional(),
    has_elderly: z.boolean().nullable().optional(),
    contact_phone: z.string().max(32, t("phoneTooLong")).nullable().optional(),
  });
}

export type ReportFormValues = z.infer<ReturnType<typeof createReportFormSchema>>;

// Matches the API's single image_key per report.
export const MAX_IMAGES = 1;
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
