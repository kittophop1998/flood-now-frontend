"use client";

import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { PASS_LEVEL_META, VEHICLE_ICON, passLevelLabel, toneClass, vehicleLabel } from "@/lib/report-meta";
import { VEHICLES, type PassLevel, type Passability, type Vehicle } from "@/types/report";

// Compact one-line summary for cards/previews: each vehicle icon with its
// status icon + short label. Unknown vehicles are omitted.
export function PassabilitySummary({ passability, className }: { passability: Passability; className?: string }) {
  const { t } = useTranslation();
  const known = VEHICLES.filter((v) => passability[v] !== "unknown");
  if (known.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label={t("passabilityHeading")}>
      {known.map((vehicle) => {
        const level = passability[vehicle];
        const VehicleIcon = VEHICLE_ICON[vehicle];
        const meta = PASS_LEVEL_META[level];
        const LevelIcon = meta.icon;
        return (
          <li
            key={vehicle}
            className={cn("inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-xs font-medium", toneClass(meta.tone))}
          >
            <VehicleIcon className="size-3.5" aria-hidden />
            <span className="sr-only">{vehicleLabel(t, vehicle)}:</span>
            <LevelIcon className="size-3.5" aria-hidden />
            {passLevelLabel(t, level)}
          </li>
        );
      })}
    </ul>
  );
}

// Detail view: one card per vehicle so "can a sedan get through" is
// answerable at a glance.
export function PassabilityGrid({ passability }: { passability: Passability }) {
  const { t } = useTranslation();
  return (
    <dl className="grid grid-cols-2 gap-2">
      {VEHICLES.map((vehicle) => {
        const level = passability[vehicle];
        const VehicleIcon = VEHICLE_ICON[vehicle];
        const meta = PASS_LEVEL_META[level];
        const LevelIcon = meta.icon;
        return (
          <div key={vehicle} className={cn("flex items-center gap-2.5 rounded-xl border px-3 py-2.5", toneClass(meta.tone))}>
            <VehicleIcon className="size-5 shrink-0" aria-hidden />
            <div className="min-w-0">
              <dt className="text-xs opacity-80">{vehicleLabel(t, vehicle)}</dt>
              <dd className="flex items-center gap-1 text-sm font-semibold">
                <LevelIcon className="size-4 shrink-0" aria-hidden />
                {passLevelLabel(t, level)}
              </dd>
            </div>
          </div>
        );
      })}
    </dl>
  );
}

const SELECTABLE: PassLevel[] = ["passable", "caution", "not_recommended", "impassable"];

// Form control: a row per vehicle with a 4-option segmented control.
// Tapping the selected option again clears it back to "unknown".
export function PassabilitySelector({
  value,
  onChange,
}: {
  value: Passability;
  onChange: (next: Passability) => void;
}) {
  const { t } = useTranslation();

  function set(vehicle: Vehicle, level: PassLevel) {
    onChange({ ...value, [vehicle]: value[vehicle] === level ? "unknown" : level });
  }

  return (
    <div className="flex flex-col gap-3">
      {VEHICLES.map((vehicle) => {
        const VehicleIcon = VEHICLE_ICON[vehicle];
        const labelId = `pass-${vehicle}`;
        return (
          <div key={vehicle} className="flex flex-col gap-1.5">
            <span id={labelId} className="flex items-center gap-1.5 text-sm font-medium">
              <VehicleIcon className="size-4 text-muted-foreground" aria-hidden />
              {vehicleLabel(t, vehicle)}
            </span>
            <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-4 gap-1.5">
              {SELECTABLE.map((level) => {
                const meta = PASS_LEVEL_META[level];
                const LevelIcon = meta.icon;
                const selected = value[vehicle] === level;
                return (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => set(vehicle, level)}
                    className={cn(
                      "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1 text-[11px] leading-tight font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                      selected ? cn(toneClass(meta.tone), "border-current ring-1 ring-current") : "bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <LevelIcon className="size-4" aria-hidden />
                    {passLevelLabel(t, level)}
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
