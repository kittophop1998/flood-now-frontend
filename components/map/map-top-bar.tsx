"use client";

import { useState } from "react";
import { Clock, Layers, Loader2, LocateFixed, MapPin, Search, SlidersHorizontal, TriangleAlert, X, Zap } from "lucide-react";
import { usePlaceSearch } from "@/features/reports/use-place-search";
import { CATEGORY_CHIPS, SEVERE, isSevereOnly, toggleChipTypes, countAdvancedFilters, type MapFilters } from "@/lib/map-filters";
import { CATEGORY_META } from "@/lib/report-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n/locale";
import type { BoundingBox, Place } from "@/types/report";

const chipBase =
  "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring after:absolute after:-inset-y-1 after:inset-x-0 after:content-['']";
const chipOff = "border-border bg-background/95 text-foreground hover:bg-muted";
const chipOn = "border-primary bg-primary text-primary-foreground";

export function MapTopBar({
  filters,
  onFiltersChange,
  onOpenFilterSheet,
  onSelectPlace,
  searchArea,
  canFilterNearMe,
  onNeedLocation,
  onOpenLayers,
  layersActive,
}: {
  filters: MapFilters;
  onFiltersChange: (next: MapFilters) => void;
  onOpenFilterSheet: () => void;
  onSelectPlace: (place: Place) => void;
  searchArea: BoundingBox | null;
  canFilterNearMe: boolean;
  onNeedLocation: () => void;
  onOpenLayers: () => void;
  layersActive: number;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const { results, status, search, clear } = usePlaceSearch();
  const advancedCount = countAdvancedFilters(filters);
  const showResults = status !== "idle";

  const quick: { id: string; label: TranslationKey; icon: typeof Clock; on: boolean; toggle: () => void }[] = [
    {
      id: "nearMe",
      label: "quick.nearMe",
      icon: LocateFixed,
      on: filters.nearMe,
      toggle: () => {
        if (!filters.nearMe && !canFilterNearMe) return onNeedLocation();
        onFiltersChange({ ...filters, nearMe: !filters.nearMe });
      },
    },
    {
      id: "recent",
      label: "quick.recent",
      icon: Clock,
      on: filters.updatedWithinMin === 60,
      toggle: () => onFiltersChange({ ...filters, updatedWithinMin: filters.updatedWithinMin === 60 ? null : 60 }),
    },
    {
      id: "severe",
      label: "quick.severe",
      icon: TriangleAlert,
      on: isSevereOnly(filters),
      toggle: () => onFiltersChange({ ...filters, severities: isSevereOnly(filters) ? [] : SEVERE }),
    },
    {
      id: "active",
      label: "quick.active",
      icon: Zap,
      on: filters.activeOnly,
      toggle: () => onFiltersChange({ ...filters, activeOnly: !filters.activeOnly }),
    },
  ];

  return (
    <div className="pointer-events-none flex flex-col gap-2 sm:max-w-xl">
      <div className="pointer-events-auto relative mx-3 flex gap-2">
        <form
          role="search"
          className="flex h-12 min-w-0 flex-1 items-center gap-1 rounded-2xl border bg-background pr-1 pl-3.5 shadow-md focus-within:ring-2 focus-within:ring-ring/50"
          onSubmit={(e) => {
            e.preventDefault();
            search(query, searchArea ?? undefined);
          }}
        >
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                clear();
              }}
              aria-label={t("clearSearch")}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          )}
        </form>
        <button
          type="button"
          onClick={onOpenFilterSheet}
          aria-label={advancedCount > 0 ? `${t("filtersButton")} (${advancedCount})` : t("filtersButton")}
          className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl border bg-background shadow-md hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <SlidersHorizontal className="size-5" aria-hidden />
          {advancedCount > 0 && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
              {advancedCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onOpenLayers}
          aria-label={layersActive > 0 ? `${t("layersTitle")} (${layersActive})` : t("layersTitle")}
          className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl border bg-background shadow-md hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Layers className="size-5" aria-hidden />
          {layersActive > 0 && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-indigo-700 text-[11px] font-semibold text-white">
              {layersActive}
            </span>
          )}
        </button>

        {showResults && (
          <div className="absolute inset-x-0 top-14 z-10 overflow-hidden rounded-2xl border bg-background shadow-xl">
            {status === "loading" && (
              <p className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t("loading")}
              </p>
            )}
            {status === "error" && <p className="px-4 py-3 text-sm text-destructive">{t("searchFailed")}</p>}
            {status === "ready" && results.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">{t("searchNoResults")}</p>}
            {status === "ready" && results.length > 0 && (
              <ul className="max-h-72 overflow-y-auto py-1">
                {results.map((place) => (
                  <li key={`${place.latitude},${place.longitude}`}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectPlace(place);
                        setQuery(place.name);
                        clear();
                      }}
                      className="flex min-h-12 w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{place.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{place.display_name}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="no-scrollbar pointer-events-auto flex gap-2 overflow-x-auto px-3 py-1" aria-label={t("filterCategories")} role="group">
        <button
          type="button"
          aria-pressed={filters.types.length === 0}
          onClick={() => onFiltersChange({ ...filters, types: [] })}
          className={cn(chipBase, filters.types.length === 0 ? chipOn : chipOff)}
        >
          {t("filterAll")}
        </button>
        {CATEGORY_CHIPS.map((chip) => {
          const on = chip.types.every((type) => filters.types.includes(type));
          const Icon = CATEGORY_META[chip.types[0]].icon;
          return (
            <button
              key={chip.id}
              type="button"
              aria-pressed={on}
              onClick={() => onFiltersChange({ ...filters, types: toggleChipTypes(filters.types, chip.types) })}
              className={cn(chipBase, on ? chipOn : chipOff)}
            >
              <Icon className="size-4" style={on ? undefined : { color: CATEGORY_META[chip.types[0]].color }} aria-hidden />
              {t(`chip.${chip.id}` as TranslationKey)}
            </button>
          );
        })}
      </div>

      <div className="no-scrollbar pointer-events-auto -mt-1 flex gap-2 overflow-x-auto px-3 py-1" role="group" aria-label={t("filtersTitle")}>
        {quick.map((q) => {
          const Icon = q.icon;
          return (
            <button
              key={q.id}
              type="button"
              aria-pressed={q.on}
              onClick={q.toggle}
              className={cn(chipBase, "h-8 px-2.5 text-xs after:-inset-y-1.5", q.on ? "border-primary bg-accent text-primary" : chipOff)}
            >
              <Icon className="size-3.5" aria-hidden />
              {t(q.label)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
