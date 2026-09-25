"use client";

import { useState, type ReactNode } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_FILTERS,
  RADIUS_OPTIONS_KM,
  UPDATED_WITHIN_OPTIONS_MIN,
  type MapFilters,
} from "@/lib/map-filters";
import { CATEGORY_META, SEVERITY_META, VEHICLE_ICON, categoryLabel, severityLabel, vehicleLabel } from "@/lib/report-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { REPORT_TYPES, SEVERITIES, VEHICLES } from "@/types/report";

const optionClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const on = "border-primary bg-accent text-primary";
const off = "bg-background hover:bg-muted";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// Advanced filters. Edits a local copy and applies it on "Show results" so
// the map doesn't refetch on every tap.
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh] sm:mx-auto sm:max-w-lg">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-lg font-semibold">{t("filtersTitle")}</DrawerTitle>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
          <Group title={t("filterCategories")}>
            {REPORT_TYPES.map((type) => {
              const Icon = CATEGORY_META[type].icon;
              const selected = draft.types.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDraft({ ...draft, types: toggle(draft.types, type) })}
                  className={cn(optionClass, selected ? on : off)}
                >
                  <Icon className="size-4" style={{ color: CATEGORY_META[type].color }} aria-hidden />
                  {categoryLabel(t, type)}
                </button>
              );
            })}
          </Group>

          <Group title={t("filterSeverity")}>
            {SEVERITIES.map((severity) => {
              const Icon = SEVERITY_META[severity].icon;
              const selected = draft.severities.includes(severity);
              return (
                <button
                  key={severity}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDraft({ ...draft, severities: toggle(draft.severities, severity) })}
                  className={cn(optionClass, selected ? on : off)}
                >
                  <Icon className="size-4" aria-hidden />
                  {severityLabel(t, severity)}
                </button>
              );
            })}
          </Group>

          <Group title={t("filterStatus")} radio>
            <Radio selected={!draft.activeOnly} onClick={() => setDraft({ ...draft, activeOnly: false })}>
              {t("filterStatusAll")}
            </Radio>
            <Radio selected={draft.activeOnly} onClick={() => setDraft({ ...draft, activeOnly: true })}>
              {t("filterStatusActive")}
            </Radio>
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

          <Group title={t("filterUpdated")} radio>
            <Radio selected={draft.updatedWithinMin == null} onClick={() => setDraft({ ...draft, updatedWithinMin: null })}>
              {t("filterUpdatedAny")}
            </Radio>
            {UPDATED_WITHIN_OPTIONS_MIN.map((min) => (
              <Radio key={min} selected={draft.updatedWithinMin === min} onClick={() => setDraft({ ...draft, updatedWithinMin: min })}>
                {t("withinHours", { n: min / 60 })}
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
        <div className="grid shrink-0 grid-cols-[auto_1fr] gap-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
      </DrawerContent>
    </Drawer>
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
