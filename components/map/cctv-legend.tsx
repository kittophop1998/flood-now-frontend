"use client";

import { Loader2, RotateCw } from "lucide-react";
import { CCTV_META } from "@/lib/community-meta";
import { formatClockTime } from "@/lib/freshness";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { CctvLayerStatus } from "@/features/layers/use-doh-cctv";
import type { CctvLayer } from "@/types/community";

// The camera glyph used wherever the layer is named (legend, layer row,
// sheets) — the same white disc + navy camera as the map marker.
export function CctvGlyph({ className }: { className?: string }) {
  const Icon = CCTV_META.icon;
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm [&>svg]:size-4", className)}
      style={{ color: CCTV_META.color }}
      aria-hidden
    >
      <Icon strokeWidth={2.25} />
    </span>
  );
}

// One-line status for the layer: failed (with retry), "as of …" when the
// list isn't current, or a zoom-in hint. Null when there's nothing to say.
export function CctvLayerStatusLine({
  layer,
  status,
  stale,
  onRetry,
  className,
}: {
  layer: CctvLayer | null;
  status: CctvLayerStatus;
  stale: boolean;
  onRetry: () => void;
  className?: string;
}) {
  const { t, locale } = useTranslation();
  if (status === "error" || stale) {
    return (
      <span role={status === "error" && !layer ? "alert" : "status"} className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs", className)}>
        {status === "error" && !layer && <span className="font-medium text-destructive">{t("cctvLoadFailed")}</span>}
        {layer && stale && (
          <>
            <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 font-semibold text-amber-900">{t("cctvStaleBadge")}</span>
            <span className="text-muted-foreground">{t("cctvAsOf", { when: formatClockTime(layer.fetched_at, locale) })}</span>
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
  if (layer?.has_more) return <span className={cn("text-xs text-muted-foreground", className)}>{t("cctvZoomIn")}</span>;
  return null;
}

// Tiny legend shown over the map only while the camera layer is on. Tapping
// it opens the layers sheet.
export function CctvLegend({
  layer,
  status,
  stale,
  onOpenLayers,
  onRetry,
}: {
  layer: CctvLayer | null;
  status: CctvLayerStatus;
  stale: boolean;
  onOpenLayers: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex max-w-[calc(100vw-6rem)] flex-col gap-1 rounded-2xl border bg-background/95 px-2.5 py-1.5 shadow-md backdrop-blur sm:max-w-xs">
      <button
        type="button"
        onClick={onOpenLayers}
        aria-label={t("cctvLegendAria")}
        className="-mx-1 flex min-h-8 items-center gap-2 rounded-xl px-1 text-left text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring"
      >
        <CctvGlyph className="size-6 [&>svg]:size-3.5" />
        <span className="min-w-0 truncate">{t("layerCctvToggle")}</span>
        {status === "loading" && <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-label={t("cctvLoading")} />}
      </button>
      {(status === "error" || stale) && <CctvLayerStatusLine layer={layer} status={status} stale={stale} onRetry={onRetry} />}
    </div>
  );
}
