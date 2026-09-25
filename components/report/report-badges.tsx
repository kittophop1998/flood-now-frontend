"use client";

import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { REPORT_TYPE_META, SEVERITY_META, reportTypeLabel, severityLabel } from "@/lib/report-meta";
import type { ReportType, Severity } from "@/types/report";

export function TypeBadge({ type, className }: { type: ReportType; className?: string }) {
  const { t } = useTranslation();
  const meta = REPORT_TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-sm font-medium",
        meta.color,
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      {reportTypeLabel(t, type)}
    </span>
  );
}

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const { t } = useTranslation();
  const meta = SEVERITY_META[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-medium",
        meta.badgeClass,
        className,
      )}
    >
      {severityLabel(t, severity)}
    </span>
  );
}
