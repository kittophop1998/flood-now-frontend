"use client";

import { CATEGORY_META, SEVERITY_META, WATER_DEPTH_META, categoryLabel, severityLabel, toneClass, waterDepthLabel } from "@/lib/report-meta";
import { DepthGauge } from "@/components/report/report-badges";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { CREATABLE_REPORT_TYPES, SEVERITIES, WATER_DEPTHS, type CreatableReportType, type Severity, type WaterDepth } from "@/types/report";

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
  // Seven categories: flood (the headline case) spans a full row on narrow
  // screens (1 + 3 + 3) and two cells on wider ones (4 + 4), so the grid
  // never ends in a half-empty row.
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} aria-invalid={invalid} className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-4">
      {CREATABLE_REPORT_TYPES.map((type, i) => {
        const meta = CATEGORY_META[type];
        const Icon = meta.icon;
        const selected = value === type;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(type)}
            className={cn(
              "flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-2 text-center text-xs leading-tight font-medium transition-colors",
              i === 0 && "col-span-3 min-[400px]:col-span-2",
              optionFocus,
              selected ? "border-primary bg-accent text-foreground ring-2 ring-primary/30" : "bg-background hover:bg-muted",
            )}
          >
            <span className="flex size-8 items-center justify-center rounded-full text-white" style={{ backgroundColor: meta.color }}>
              <Icon className="size-4" aria-hidden />
            </span>
            {categoryLabel(t, type)}
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
