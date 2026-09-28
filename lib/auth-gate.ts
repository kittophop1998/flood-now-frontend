// Guest-first permission model (docs/product-spec.md#accounts): a guest can
// view everything and report safety-critical incidents; interacting, saving,
// SOS and owning content need an account. The server enforces all of it —
// this only decides when the app asks a guest to sign in, and why.
import { CATEGORY_META } from "@/lib/report-meta";
import type { ReportType } from "@/types/report";

// Why the "sign in to use this feature" sheet opened (its explanation line).
export type AuthReason = "react" | "sos" | "helper" | "savePlace" | "createEvent" | "reportCategory" | "generic";

// Whether someone who isn't signed in may report this category. Mirrors the
// API's guest-reportable rule (apps/api/internal/domain/report/report.go).
export function isGuestReportable(type: ReportType): boolean {
  return CATEGORY_META[type]?.guestReportable === true;
}

// A category the current person may pick in the report form.
export function canReport(type: ReportType, signedIn: boolean): boolean {
  return signedIn || isGuestReportable(type);
}
