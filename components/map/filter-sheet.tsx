"use client";

import { useState, type ReactNode } from "react";
import { Clock, OctagonAlert, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_CHIPS,
  DEFAULT_FILTERS,
  RADIUS_OPTIONS_KM,
  RECENT_WINDOW_MIN,
  SEVERE,
  toggleChipTypes,
  type MapFilters,
} from "@/lib/map-filters";
import { CATEGORY_META, VEHICLE_ICON, vehicleLabel } from "@/lib/report-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { TranslationKey } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import { VEHICLES } from "@/types/report";

const optionClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const on = "border-primary bg-accent text-primary";
const off = "bg-background hover:bg-muted";

// Every filter beyond the map's two quick toggles: incident type, status
// (ongoing / latest / severe), distance and "can't pass by" vehicle. Edits a
// local copy and applies it on "Show results" so the map doesn't refetch on
// every tap.
export function FilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
  canFilterNearMe,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: MapFilters;
  onApply: (filters: MapFilters) => void;
  canFilterNearMe: boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(filters);
  const [syncedFrom, setSyncedFrom] = useState(filters);
  // Re-seed the draft whenever the sheet is reopened with different filters.
  if (open && syncedFrom !== filters) {
    setSyncedFrom(filters);
    setDraft(filters);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="px-4 pt-4 pb-3 pr-12">
          <DialogTitle className="text-lg font-semibold">{t("filtersTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
          <Group title={t("filterCategories")}>
            {CATEGORY_CHIPS.map((chip) => {
              const meta = CATEGORY_META[chip.id === "legacy" ? "other" : chip.types[0]];
              const Icon = meta.icon;
              const selected = chip.types.every((type) => draft.types.includes(type));
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDraft({ ...draft, types: toggleChipTypes(draft.types, chip.types) })}
                  className={cn(optionClass, selected ? on : off)}
                >
                  <Icon className="size-4" style={{ color: meta.color }} aria-hidden />
                  {t(`chip.${chip.id}` as TranslationKey)}
                </button>
              );
            })}
          </Group>

          <Group title={t("filterStatus")}>
            <Toggle
              selected={draft.activeOnly}
              icon={<Zap className="size-4" aria-hidden />}
              onClick={() => setDraft({ ...draft, activeOnly: !draft.activeOnly })}
            >
              {t("quick.active")}
            </Toggle>
            <Toggle
              selected={draft.updatedWithinMin != null}
              icon={<Clock className="size-4" aria-hidden />}
              onClick={() => setDraft({ ...draft, updatedWithinMin: draft.updatedWithinMin != null ? null : RECENT_WINDOW_MIN })}
            >
              {t("quick.recent")}
            </Toggle>
            <Toggle
              selected={draft.severities.length > 0}
              icon={<OctagonAlert className="size-4" aria-hidden />}
              onClick={() => setDraft({ ...draft, severities: draft.severities.length > 0 ? [] : SEVERE })}
            >
              {t("quick.severe")}
            </Toggle>
          </Group>

          <Group title={t("filterDistance")} radio note={canFilterNearMe ? undefined : t("nearMeNeedsLocation")}>
            <Radio selected={!draft.nearMe} onClick={() => setDraft({ ...draft, nearMe: false })}>
              {t("filterDistanceAny")}
            </Radio>
            {RADIUS_OPTIONS_KM.map((km) => (
              <Radio
                key={km}
                selected={draft.nearMe && draft.radiusKm === km}
                disabled={!canFilterNearMe}
                onClick={() => setDraft({ ...draft, nearMe: true, radiusKm: km })}
              >
                {t("kilometersValue", { n: km })}
              </Radio>
            ))}
          </Group>

          <Group title={t("filterBlockedFor")} radio>
            <Radio selected={draft.blockedFor == null} onClick={() => setDraft({ ...draft, blockedFor: null })}>
              {t("filterBlockedAny")}
            </Radio>
            {VEHICLES.map((vehicle) => {
              const Icon = VEHICLE_ICON[vehicle];
              return (
                <Radio key={vehicle} selected={draft.blockedFor === vehicle} onClick={() => setDraft({ ...draft, blockedFor: vehicle })}>
                  <Icon className="size-4" aria-hidden />
                  {vehicleLabel(t, vehicle)}
                </Radio>
              );
            })}
          </Group>
        </div>
        <div className="grid shrink-0 grid-cols-[auto_1fr] gap-2 border-t px-4 py-3">
          <Button variant="outline" className="h-12 rounded-xl px-4" onClick={() => setDraft(DEFAULT_FILTERS)}>
            {t("filtersReset")}
          </Button>
          <Button
            className="h-12 rounded-xl text-base"
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            {t("filtersApply")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Group({ title, note, radio, children }: { title: string; note?: string; radio?: boolean; children: ReactNode }) {
  const id = `filter-${title.replace(/\s+/g, "-")}`;
  return (
    <section className="flex flex-col gap-2">
      <h3 id={id} className="text-sm font-semibold">
        {title}
      </h3>
      <div role={radio ? "radiogroup" : "group"} aria-labelledby={id} className="flex flex-wrap gap-2">
        {children}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </section>
  );
}

function Toggle({ selected, icon, onClick, children }: { selected: boolean; icon: ReactNode; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={cn(optionClass, selected ? on : off)}>
      {icon}
      {children}
    </button>
  );
}

function Radio({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(optionClass, selected ? on : off, "disabled:opacity-50")}
    >
      {children}
    </button>
  );
}
