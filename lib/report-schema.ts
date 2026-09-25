import { z } from "zod";
import { REPORT_TYPES, SEVERITIES } from "@/types/report";

// Client-side mirror of the validation rules in
// apps/api/internal/domain/report/report.go — kept close to the API's
// rules so the form fails fast before hitting the network.
export const reportFormSchema = z.object({
  type: z.enum(REPORT_TYPES, { message: "Choose a report type" }),
  severity: z.enum(SEVERITIES, { message: "Choose a severity" }),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  water_level_cm: z.number().int().min(0).max(1000).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  people_count: z.number().int().min(0).max(999).nullable().optional(),
  has_child: z.boolean().nullable().optional(),
  has_elderly: z.boolean().nullable().optional(),
  contact_phone: z.string().max(32).nullable().optional(),
});

export type ReportFormValues = z.infer<typeof reportFormSchema>;

export const confirmationSchema = z.object({
  device_id: z.string().min(8).max(128),
  status: z.enum(["still_active", "cleared"]),
});

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Only JPEG, PNG, or WEBP images are supported.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Image must be smaller than 8 MB.";
  }
  return null;
}
