"use client";

import { LockKeyhole } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { canReport } from "@/lib/auth-gate";
import {
  CATEGORY_META,
  SEVERITY_META,
  WATER_DEPTH_META,
  categoryLabel,
  detailFields,
  detailLabel,
  detailValueLabel,
  severityLabel,
  toneClass,
  waterDepthLabel,
} from "@/lib/report-meta";
import { DepthGauge } from "@/components/report/report-badges";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import {
  CREATABLE_REPORT_TYPES,
  SEVERITIES,
  WATER_DEPTHS,
  type CreatableReportType,
  type ReportDetails,
  type ReportType,
  type Severity,
  type WaterDepth,
} from "@/types/report";

const optionFocus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function CategoryPicker({
  value,
  onChange,
  labelledBy,
  invalid,
}: {
  value: CreatableReportType | undefined;
  onChange: (type: CreatableReportType) => void;
  labelledBy: string;
  invalid?: boolean;
}) {
  const { t } = useTranslation();
  const { user, requireAuth } = useAuth();
  // Ten year-round categories, all equal (no category is the default):
  // two columns of icon + label on phones, 5 × 2 tiles on wider screens —
  // always full rows. A guest can report the safety-critical ones; the rest
  // show a lock and ask to sign in first (then get selected).
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} aria-invalid={invalid} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {CREATABLE_REPORT_TYPES.map((type) => {
        const meta = CATEGORY_META[type];
        const Icon = meta.icon;
        const selected = value === type;
        const locked = !canReport(type, user != null);
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={locked ? `${categoryLabel(t, type)} (${t("categoryNeedsSignIn")})` : undefined}
            onClick={() => (locked ? requireAuth("reportCategory", () => onChange(type)) : onChange(type))}
            className={cn(
              "relative flex min-h-12 items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-sm leading-tight font-medium transition-colors sm:min-h-[76px] sm:flex-col sm:justify-center sm:gap-1.5 sm:px-1 sm:text-center sm:text-xs",
              optionFocus,
              selected ? "border-primary bg-accent text-foreground ring-2 ring-primary/30" : "bg-background hover:bg-muted",
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: meta.color }}>
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 sm:flex-none">{categoryLabel(t, type)}</span>
            {locked && <LockKeyhole className="absolute top-1.5 right-1.5 size-3 text-muted-foreground" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

export function SeverityPicker({
  value,
  onChange,
  labelledBy,
  invalid,
}: {
  value: Severity | undefined;
  onChange: (severity: Severity) => void;
  labelledBy: string;
  invalid?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} aria-invalid={invalid} className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-4">
      {SEVERITIES.map((severity) => {
        const meta = SEVERITY_META[severity];
        const Icon = meta.icon;
        const selected = value === severity;
        return (
          <button
            key={severity}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(severity)}
            className={cn(
              "flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-xl border px-3 py-2 text-left transition-colors",
              optionFocus,
              selected ? cn(toneClass(meta.tone), "border-current ring-1 ring-current") : "bg-background hover:bg-muted",
            )}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Icon className="size-4" aria-hidden />
              {severityLabel(t, severity)}
            </span>
            <span className={cn("text-[11px] leading-tight", selected ? "opacity-90" : "text-muted-foreground")}>
              {t(`severityHint.${severity}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function WaterDepthPicker({
  value,
  onChange,
  labelledBy,
}: {
  value: WaterDepth | null | undefined;
  onChange: (depth: WaterDepth) => void;
  labelledBy: string;
}) {
  const { t } = useTranslation();
  // Deepest first reads like a ruler; "not sure" last.
  const order: WaterDepth[] = [...WATER_DEPTHS.filter((d) => d !== "unknown"), "unknown"];
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-5 gap-1.5">
      {order.map((depth) => {
        const selected = value === depth;
        const range = WATER_DEPTH_META[depth].rangeKey;
        return (
          <button
            key={depth}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(depth)}
            className={cn(
              "flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-0.5 py-2 text-center transition-colors",
              optionFocus,
              selected ? "border-sky-600 bg-sky-50 text-sky-900 ring-1 ring-sky-600" : "bg-background hover:bg-muted",
            )}
          >
            {depth === "unknown" ? <span className="h-4 text-sm leading-4 font-semibold">?</span> : <DepthGauge depth={depth} />}
            <span className="text-xs leading-tight font-semibold">{waterDepthLabel(t, depth)}</span>
            {range && <span className="text-[10px] leading-tight text-muted-foreground">{t(range)}</span>}
          </button>
        );
      })}
    </div>
  );
}

// The category's optional details (lanes blocked, closure, damage type…) as
// rows of chips. Tapping the selected chip again clears it — none is required.
export function DetailPicker({
  type,
  value,
  onChange,
  idPrefix,
}: {
  type: ReportType;
  value: ReportDetails | null | undefined;
  onChange: (details: ReportDetails) => void;
  idPrefix: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      {detailFields(type).map((field) => {
        const labelId = `${idPrefix}-${field.key}`;
        const current = value?.[field.key];
        return (
          <div key={field.key} className="flex flex-col gap-1.5">
            <p id={labelId} className="text-xs font-medium text-muted-foreground">
              {detailLabel(t, field.key)}
            </p>
            <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
              {field.options.map((option) => {
                const selected = current === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      const next = { ...value };
                      if (selected) delete next[field.key];
                      else next[field.key] = option;
                      onChange(next);
                    }}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-medium transition-colors",
                      optionFocus,
                      selected ? "border-primary bg-accent text-primary ring-1 ring-primary/30" : "bg-background hover:bg-muted",
                    )}
                  >
                    {detailValueLabel(t, field.key, option)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
