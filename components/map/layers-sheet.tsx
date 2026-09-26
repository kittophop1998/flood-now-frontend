"use client";

import type { ReactNode } from "react";
import { Loader2, MapPin, UsersRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FloodLayerStatusLine, FloodSwatch } from "@/components/map/official-flood-legend";
import { CctvGlyph, CctvLayerStatusLine } from "@/components/map/cctv-legend";
import { IMPORTANT_PLACE_META, OFFICIAL_ICON } from "@/lib/community-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { LayerFilters } from "@/features/layers/use-viewport-layers";
import type { FloodLayerStatus } from "@/features/layers/use-gistda-flood";
import type { CctvLayerStatus } from "@/features/layers/use-doh-cctv";
import { GISTDA_PERIODS, IMPORTANT_PLACE_CATEGORIES, IMPORTANT_PLACE_STATUSES, type CctvLayer, type FloodLayer } from "@/types/community";

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export interface GistdaLayerState {
  // The API has the layer configured; otherwise the row isn't shown.
  available: boolean;
  layer: FloodLayer | null;
  status: FloodLayerStatus;
  stale: boolean;
  onRetry: () => void;
}

export interface CctvLayerState {
  // The API has the layer enabled; otherwise the row isn't shown.
  available: boolean;
  layer: CctvLayer | null;
  status: CctvLayerStatus;
  stale: boolean;
  onRetry: () => void;
}

function LayerRow({
  id,
  icon,
  label,
  checked,
  onCheckedChange,
  trailing,
}: {
  id: string;
  icon: ReactNode;
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex min-h-13 items-center gap-3">
      {icon}
      <Label htmlFor={id} className="min-w-0 flex-1 font-medium">
        {label}
      </Label>
      {trailing}
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function RowIcon({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4", className)}>{children}</span>;
}

// Map layers, grouped by where the data comes from: community reports,
// official data (GISTDA flood areas, announcements) and important places.
// Changes apply live.
export function LayersSheet({
  open,
  onOpenChange,
  layers,
  onChange,
  gistda,
  cctv,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layers: LayerFilters;
  onChange: (next: LayerFilters) => void;
  gistda: GistdaLayerState;
  cctv: CctvLayerState;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="px-4 pt-4 pb-3 pr-12">
          <DialogTitle className="text-lg font-semibold">{t("layersTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          <section className="flex flex-col gap-1.5" aria-labelledby="layer-sec-reports">
            <h3 id="layer-sec-reports" className="text-xs font-semibold tracking-wide text-muted-foreground">
              {t("layerSectionReports")}
            </h3>
            <div className="rounded-2xl border px-3">
              <LayerRow
                id="sheet-layer-reports"
                icon={
                  <RowIcon className="bg-muted text-slate-700">
                    <UsersRound />
                  </RowIcon>
                }
                label={t("layerReportsToggle")}
                checked={layers.reports}
                onCheckedChange={(v) => onChange({ ...layers, reports: v })}
              />
            </div>
          </section>

          <section className="flex flex-col gap-1.5" aria-labelledby="layer-sec-official">
            <h3 id="layer-sec-official" className="text-xs font-semibold tracking-wide text-muted-foreground">
              {t("layerSectionOfficial")}
            </h3>
            <div className="flex flex-col divide-y rounded-2xl border px-3">
              {gistda.available && (
                <div className="flex flex-col pb-1">
                  <LayerRow
                    id="sheet-layer-gistda"
                    icon={<FloodSwatch className="size-8" />}
                    label={t("layerGistdaToggle")}
                    checked={layers.gistdaFlood}
                    onCheckedChange={(v) => onChange({ ...layers, gistdaFlood: v })}
                    trailing={
                      layers.gistdaFlood && gistda.status === "loading" ? (
                        <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-label={t("gistdaLoading")} role="status" />
                      ) : undefined
                    }
                  />
                  {layers.gistdaFlood && (
                    <div className="flex flex-col gap-2 pb-2 pl-11">
                      <div role="radiogroup" aria-label={t("gistdaPeriodLabel")} className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1">
                        {GISTDA_PERIODS.map((p) => {
                          const on = layers.gistdaPeriod === p;
                          return (
                            <button
                              key={p}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              onClick={() => onChange({ ...layers, gistdaPeriod: p })}
                              className={cn(
                                "min-h-11 rounded-lg px-1 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                                on ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {t(`gistdaPeriod.${p}`)}
                            </button>
                          );
                        })}
                      </div>
                      <FloodLayerStatusLine layer={gistda.layer} status={gistda.status} stale={gistda.stale} onRetry={gistda.onRetry} />
                    </div>
                  )}
                </div>
              )}
              {cctv.available && (
                <div className="flex flex-col">
                  <LayerRow
                    id="sheet-layer-cctv"
                    icon={<CctvGlyph className="size-8" />}
                    label={t("layerCctvToggle")}
                    checked={layers.dohCctv}
                    onCheckedChange={(v) => onChange({ ...layers, dohCctv: v })}
                    trailing={
                      layers.dohCctv && cctv.status === "loading" ? (
                        <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-label={t("cctvLoading")} role="status" />
                      ) : undefined
                    }
                  />
                  {layers.dohCctv && (
                    <CctvLayerStatusLine className="pb-2 pl-11" layer={cctv.layer} status={cctv.status} stale={cctv.stale} onRetry={cctv.onRetry} />
                  )}
                </div>
              )}
              <LayerRow
                id="sheet-layer-ann"
                icon={
                  <RowIcon className="bg-indigo-700 text-white">
                    <OFFICIAL_ICON />
                  </RowIcon>
                }
                label={t("layerAnnouncementsToggle")}
                checked={layers.announcements}
                onCheckedChange={(v) => onChange({ ...layers, announcements: v })}
              />
            </div>
          </section>

          <section className="flex flex-col gap-1.5" aria-labelledby="layer-sec-places">
            <h3 id="layer-sec-places" className="text-xs font-semibold tracking-wide text-muted-foreground">
              {t("layerSectionPlaces")}
            </h3>
            <div className="rounded-2xl border px-3">
              <LayerRow
                id="sheet-layer-places"
                icon={
                  <RowIcon className="bg-muted text-slate-700">
                    <MapPin />
                  </RowIcon>
                }
                label={t("layerPlacesToggle")}
                checked={layers.places}
                onCheckedChange={(v) => onChange({ ...layers, places: v })}
              />
            </div>
          </section>

          {layers.places && (
            <>
              <section className="flex flex-col gap-2">
                <h3 id="layer-cat" className="text-sm font-semibold">
                  {t("filterCategories")}
                </h3>
                <div role="group" aria-labelledby="layer-cat" className="flex flex-wrap gap-2">
                  {IMPORTANT_PLACE_CATEGORIES.map((c) => {
                    const meta = IMPORTANT_PLACE_META[c];
                    const on = layers.placeCategories.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onChange({ ...layers, placeCategories: toggle(layers.placeCategories, c) })}
                        className={cn(
                          "inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
                          on ? "border-primary bg-accent text-primary" : "bg-background hover:bg-muted",
                        )}
                      >
                        <meta.icon className="size-4" style={{ color: meta.color }} aria-hidden />
                        {t(`ipCategory.${c}`)}
                      </button>
                    );
                  })}
                </div>
              </section>
              <section className="flex flex-col gap-2">
                <h3 id="layer-status" className="text-sm font-semibold">
                  {t("filterStatus")}
                </h3>
                <div role="group" aria-labelledby="layer-status" className="flex flex-wrap gap-2">
                  {IMPORTANT_PLACE_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={layers.placeStatuses.includes(s)}
                      onClick={() => onChange({ ...layers, placeStatuses: toggle(layers.placeStatuses, s) })}
                      className={cn(
                        "min-h-11 rounded-xl border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
                        layers.placeStatuses.includes(s) ? "border-primary bg-accent text-primary" : "bg-background hover:bg-muted",
                      )}
                    >
                      {t(`ipStatus.${s}`)}
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
          <p className="text-xs text-muted-foreground">{t("layersNote")}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
