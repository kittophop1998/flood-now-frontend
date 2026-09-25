"use client";

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { IMPORTANT_PLACE_META } from "@/lib/community-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { LayerFilters } from "@/features/layers/use-viewport-layers";
import { IMPORTANT_PLACE_CATEGORIES, IMPORTANT_PLACE_STATUSES } from "@/types/community";

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

// Map layers beyond community reports: official announcements and
// important places (filterable by category/status). Changes apply live.
export function LayersSheet({
  open,
  onOpenChange,
  layers,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layers: LayerFilters;
  onChange: (next: LayerFilters) => void;
}) {
  const { t } = useTranslation();
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh] sm:mx-auto sm:max-w-lg">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-lg font-semibold">{t("layersTitle")}</DrawerTitle>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col divide-y rounded-2xl border px-4">
            <div className="flex min-h-12 items-center justify-between gap-3">
              <Label htmlFor="sheet-layer-ann" className="font-medium">
                {t("layerAnnouncementsToggle")}
              </Label>
              <Switch id="sheet-layer-ann" checked={layers.announcements} onCheckedChange={(v) => onChange({ ...layers, announcements: v })} />
            </div>
            <div className="flex min-h-12 items-center justify-between gap-3">
              <Label htmlFor="sheet-layer-places" className="font-medium">
                {t("layerPlacesToggle")}
              </Label>
              <Switch id="sheet-layer-places" checked={layers.places} onCheckedChange={(v) => onChange({ ...layers, places: v })} />
            </div>
          </div>

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
      </DrawerContent>
    </Drawer>
  );
}
