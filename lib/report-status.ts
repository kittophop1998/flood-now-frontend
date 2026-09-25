import type { Report, ReportStatus } from "@/types/report";

type LifecycleFields = Pick<Report, "status" | "stale_at" | "expires_at" | "resolved_at">;

// The API computes `status`; between polls a report can cross its stale_at /
// expires_at boundary, so the UI re-derives it from the same server-provided
// timestamps. The rule mirrors apps/api/internal/domain/report/lifecycle.go —
// only the ordering lives here, never the durations.
export function currentStatus(report: LifecycleFields, now: Date = new Date()): ReportStatus {
  if (report.resolved_at || report.status === "resolved") return "resolved";
  const t = now.getTime();
  if (t >= new Date(report.expires_at).getTime()) return "expired";
  if (t >= new Date(report.stale_at).getTime()) return "possibly_stale";
  return "active";
}

export function isOpen(status: ReportStatus): boolean {
  return status === "active" || status === "possibly_stale";
}
