"use client";

import { Loader2, RotateCw } from "lucide-react";
import { GISTDA_FLOOD_META } from "@/lib/community-meta";
import { formatClockTime } from "@/lib/freshness";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { FloodLayerStatus } from "@/features/layers/use-gistda-flood";
import type { FloodLayer, GistdaPeriod } from "@/types/community";

// The swatch used wherever the layer is named (legend, layer row, sheet).
export function FloodSwatch({ className }: { className?: string }) {
  const Icon = GISTDA_FLOOD_META.icon;
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-lg border", className)}
      style={{ backgroundColor: `${GISTDA_FLOOD_META.fill}40`, borderColor: GISTDA_FLOOD_META.line, color: GISTDA_FLOOD_META.line }}
      aria-hidden
    >
      <Icon className="size-3.5" />
    </span>
  );
}

// One-line status for the layer: loading, failed (with retry) or "as of …"
// when what's shown isn't current. Null when there's nothing to say.
export function FloodLayerStatusLine({
  layer,
  status,
  stale,
  onRetry,
  className,
}: {
  layer: FloodLayer | null;
  status: FloodLayerStatus;
  stale: boolean;
  onRetry: () => void;
  className?: string;
}) {
  const { t, locale } = useTranslation();
  if (status === "error" || stale) {
    return (
      <span role={status === "error" && !layer ? "alert" : "status"} className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs", className)}>
        {status === "error" && !layer && <span className="font-medium text-destructive">{t("gistdaLoadFailed")}</span>}
        {layer && stale && (
          <>
            <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 font-semibold text-amber-900">{t("gistdaStaleBadge")}</span>
            <span className="text-muted-foreground">{t("gistdaAsOf", { when: formatClockTime(layer.fetched_at, locale) })}</span>
          </>
        )}
        {status === "error" && (
          <button
            type="button"
            onClick={onRetry}
            className="-my-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-1.5 font-semibold text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          >
            <RotateCw className="size-3.5" aria-hidden />
            {t("retry")}
          </button>
        )}
      </span>
    );
  }
  if (layer?.has_more) return <span className={cn("text-xs text-muted-foreground", className)}>{t("gistdaZoomIn")}</span>;
  return null;
}

// Small legend shown over the map only while the GISTDA layer is on. Tapping
// it opens the layers sheet (period, toggle).
export function OfficialFloodLegend({
  period,
  layer,
  status,
  stale,
  onOpenLayers,
  onRetry,
  className,
}: {
  period: GistdaPeriod;
  layer: FloodLayer | null;
  status: FloodLayerStatus;
  stale: boolean;
  onOpenLayers: () => void;
  onRetry: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const showStatus = status === "error" || stale;
  return (
    <div className={cn("flex max-w-[calc(100vw-6rem)] flex-col gap-1 rounded-2xl border bg-background/95 px-2.5 py-1.5 shadow-md backdrop-blur sm:max-w-xs", className)}>
      <button
        type="button"
        onClick={onOpenLayers}
        aria-label={t("gistdaLegendAria")}
        className="-mx-1 flex min-h-8 items-center gap-2 rounded-xl px-1 text-left text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring"
      >
        <FloodSwatch className="size-6" />
        <span className="min-w-0 truncate">{t("layerGistdaToggle")}</span>
        <span className="shrink-0 text-muted-foreground">· {t(`gistdaPeriod.${period}`)}</span>
        {status === "loading" && <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-label={t("gistdaLoading")} />}
      </button>
      {showStatus && <FloodLayerStatusLine layer={layer} status={status} stale={stale} onRetry={onRetry} />}
    </div>
  );
}
