import { REPORT_TYPE_META } from "@/lib/report-meta";
import { cn } from "@/lib/utils";
import type { Report } from "@/types/report";

// Markers distinguish type by icon+shape, not color alone — help_needed
// gets an emphasized pulse treatment as an urgency signal (never implying
// official rescue dispatch — see docs/product-spec.md).
export function ReportMarker({ report, selected }: { report: Report; selected: boolean }) {
  const meta = REPORT_TYPE_META[report.type];
  const Icon = meta.icon;
  const isHelp = report.type === "help_needed";

  return (
    <button
      type="button"
      aria-label={`${meta.label} report`}
      className="relative flex size-11 -translate-y-1 items-center justify-center focus:outline-none"
    >
      {isHelp && (
        <span
          className="absolute inline-flex size-9 animate-ping rounded-full opacity-60"
          style={{ backgroundColor: meta.markerColor }}
        />
      )}
      <span
        className={cn(
          "relative flex size-9 items-center justify-center rounded-full border-2 border-white shadow-lg transition-transform",
          selected && "scale-110 ring-2 ring-offset-2",
        )}
        style={{ backgroundColor: meta.markerColor }}
      >
        <Icon className="size-5 text-white" aria-hidden />
      </span>
      <span
        className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-white"
        style={{ backgroundColor: meta.markerColor }}
        aria-hidden
      />
    </button>
  );
}
