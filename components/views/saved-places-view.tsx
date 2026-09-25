"use client";

import { useState } from "react";
import { Bell, BellOff, Bookmark, CircleAlert, Loader2, MapPinned, Pencil, Plus, Route, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AreaLevelBadge, StaleDataNote } from "@/components/community/badges";
import { LocationField, type LocationValue } from "@/components/community/location-field";
import { EmptyState, ViewShell } from "@/components/views/view-shell";
import { useNow } from "@/features/common/use-now";
import type { SavedPlacesApi } from "@/features/places/use-saved-places";
import { PLACE_ICON_META } from "@/lib/community-meta";
import { formatDistance } from "@/lib/distance";
import { formatFreshness } from "@/lib/freshness";
import { VEHICLE_ICON, vehicleLabel } from "@/lib/report-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { PLACE_ICONS, WATCH_RADII_M, type LatLng, type PlaceIcon, type SavedPlace } from "@/types/community";
import { VEHICLES, type Vehicle } from "@/types/report";

const optionClass =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const on = "border-primary bg-accent text-primary";
const off = "bg-background hover:bg-muted";

type PickFn = (title: string, onPick: (p: LatLng) => void) => void;

interface Draft {
  id: string | null;
  name: string;
  icon: PlaceIcon;
  location: LocationValue | null;
  radius: number;
  vehicle: Vehicle | null;
  notify: boolean;
}

function draftFrom(place: SavedPlace | null, defaultName: string): Draft {
  return place
    ? {
        id: place.id,
        name: place.name,
        icon: place.icon,
        location: { latitude: place.latitude, longitude: place.longitude, label: place.name },
        radius: place.watch_radius_m,
        vehicle: place.preferred_vehicle,
        notify: place.notification_enabled,
      }
    : { id: null, name: defaultName, icon: "home", location: null, radius: 1000, vehicle: null, notify: true };
}

// Saved places (home, work, family…): create/edit/delete, open on the map,
// use as a route start/end. Their radius is the watch area (see WatchView).
export function SavedPlacesView({
  places,
  onBack,
  hidden,
  onUseMyLocation,
  onPick,
  onShowOnMap,
  onRouteFrom,
  onRouteTo,
}: {
  places: SavedPlacesApi;
  onBack: () => void;
  hidden?: boolean;
  onUseMyLocation: () => Promise<LatLng | null>;
  onPick: PickFn;
  onShowOnMap: (place: SavedPlace) => void;
  onRouteFrom: (place: SavedPlace) => void;
  onRouteTo: (place: SavedPlace) => void;
}) {
  const { t } = useTranslation();
  const now = useNow();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; location?: string }>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function save() {
    if (!draft) return;
    const next: typeof errors = {};
    if (!draft.name.trim()) next.name = t("placeNameRequired");
    if (!draft.location) next.location = t("placeLocationRequired");
    setErrors(next);
    if (next.name || next.location) return;
    setSaving(true);
    const body = {
      name: draft.name.trim(),
      icon: draft.icon,
      latitude: draft.location!.latitude,
      longitude: draft.location!.longitude,
      watch_radius_m: draft.radius,
      preferred_vehicle: draft.vehicle ?? ("" as const),
      notification_enabled: draft.notify,
    };
    const ok = draft.id ? await places.update(draft.id, body) : await places.create({ ...body, preferred_vehicle: draft.vehicle ?? undefined });
    setSaving(false);
    if (ok) setDraft(null);
  }

  async function remove(id: string) {
    setPendingId(id);
    await places.remove(id);
    setPendingId(null);
    setConfirmDelete(null);
  }

  return (
    <ViewShell title={t("savedPlacesTitle")} subtitle={t("savedPlacesPrivate")} onBack={onBack} hidden={hidden}>
      {places.staleSince && <StaleDataNote savedAt={places.staleSince} />}

      {draft ? (
        <section aria-labelledby="place-form-title" className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-xs">
          <h2 id="place-form-title" className="font-semibold">
            {draft.id ? t("editPlace") : t("addPlace")}
          </h2>

          <div role="radiogroup" aria-label={t("placeTypeLabel")} className="grid grid-cols-4 gap-2">
            {PLACE_ICONS.map((icon) => {
              const Icon = PLACE_ICON_META[icon];
              return (
                <button
                  key={icon}
                  type="button"
                  role="radio"
                  aria-checked={draft.icon === icon}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      icon,
                      // Prefill the name from the type unless the user typed one.
                      name: !draft.name || PLACE_ICONS.some((i) => t(`placeIcon.${i}`) === draft.name) ? (icon === "custom" ? "" : t(`placeIcon.${icon}`)) : draft.name,
                    })
                  }
                  className={cn(optionClass, "flex-col px-1 py-2 text-xs", draft.icon === icon ? on : off)}
                >
                  <Icon className="size-5" aria-hidden />
                  {t(`placeIcon.${icon}`)}
                </button>
              );
            })}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="place-name">{t("placeNameLabel")}</Label>
            <Input
              id="place-name"
              className="h-11 text-base"
              maxLength={60}
              value={draft.name}
              aria-invalid={!!errors.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <LocationField
            label={t("placeLocationLabel")}
            labelId="place-location"
            value={draft.location}
            onChange={(location) => setDraft({ ...draft, location })}
            onUseMyLocation={onUseMyLocation}
            onPickOnMap={() => onPick(t("pickPlaceTitle"), (p) => setDraft((d) => (d ? { ...d, location: p } : d)))}
            searchable
            invalid={!!errors.location}
          />
          {errors.location && <p className="-mt-2 text-sm text-destructive">{errors.location}</p>}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">{t("watchRadiusLabel")}</legend>
            <div role="radiogroup" className="grid grid-cols-3 gap-2">
              {WATCH_RADII_M.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={draft.radius === r}
                  onClick={() => setDraft({ ...draft, radius: r })}
                  className={cn(optionClass, draft.radius === r ? on : off)}
                >
                  {formatDistance(r, t)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">
              {t("preferredVehicleLabel")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
            </legend>
            <div role="radiogroup" className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-4">
              {VEHICLES.map((v) => {
                const Icon = VEHICLE_ICON[v];
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={draft.vehicle === v}
                    onClick={() => setDraft({ ...draft, vehicle: draft.vehicle === v ? null : v })}
                    className={cn(optionClass, "text-xs", draft.vehicle === v ? on : off)}
                  >
                    <Icon className="size-4" aria-hidden />
                    {vehicleLabel(t, v)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-muted px-3">
            <Label htmlFor="place-notify" className="font-normal leading-snug">
              {t("watchNotifyLabel")}
            </Label>
            <Switch id="place-notify" checked={draft.notify} onCheckedChange={(v) => setDraft({ ...draft, notify: v })} />
          </div>

          {places.actionError && (
            <p role="alert" className="text-sm text-destructive">
              {places.actionError}
            </p>
          )}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button type="button" variant="outline" className="h-12 rounded-xl px-4" onClick={() => setDraft(null)}>
              {t("cancel")}
            </Button>
            <Button type="button" className="h-12 rounded-xl text-base" onClick={save} disabled={saving}>
              {saving && <Loader2 className="animate-spin" aria-hidden />}
              {t("savePlace")}
            </Button>
          </div>
        </section>
      ) : (
        <Button className="h-12 rounded-xl text-base" onClick={() => setDraft(draftFrom(null, t("placeIcon.home")))}>
          <Plus aria-hidden />
          {t("addPlace")}
        </Button>
      )}

      {places.status === "loading" && places.places.length === 0 && (
        <div className="h-28 animate-pulse rounded-2xl bg-background" aria-hidden />
      )}
      {places.status === "error" && (
        <EmptyState
          icon={<CircleAlert />}
          title={t("placesLoadFailed")}
          action={
            <Button variant="outline" className="mt-2 h-11 rounded-xl" onClick={places.reload}>
              {t("retry")}
            </Button>
          }
        />
      )}
      {places.status === "ready" && places.places.length === 0 && !draft && (
        <EmptyState icon={<Bookmark />} title={t("noSavedPlaces")} hint={t("noSavedPlacesHint")} />
      )}

      <ul className="flex flex-col gap-3">
        {places.places.map((p) => {
          const Icon = PLACE_ICON_META[p.icon];
          return (
            <li key={p.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-3.5 shadow-xs">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <AreaLevelBadge level={p.area.level} />
                    <span className="text-xs text-muted-foreground">
                      {t(p.area.active_count === 1 ? "areaActiveCountOne" : "areaActiveCount", { n: p.area.active_count, d: formatDistance(p.watch_radius_m, t) })}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    {p.notification_enabled ? <Bell className="size-3.5" aria-hidden /> : <BellOff className="size-3.5" aria-hidden />}
                    {p.notification_enabled ? t("watchOn") : t("watchOff")}
                    {p.area.latest_update_at && <> · {t("latestUpdate", { ago: formatFreshness(p.area.latest_update_at, t, now) })}</>}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="h-11 flex-col gap-0.5 rounded-xl text-xs" onClick={() => onShowOnMap(p)}>
                  <MapPinned className="size-4" aria-hidden />
                  {t("showOnMap")}
                </Button>
                <Button variant="outline" className="h-11 flex-col gap-0.5 rounded-xl text-xs" onClick={() => onRouteTo(p)}>
                  <Route className="size-4" aria-hidden />
                  {t("routeHere")}
                </Button>
                <Button variant="outline" className="h-11 flex-col gap-0.5 rounded-xl text-xs" onClick={() => onRouteFrom(p)}>
                  <Route className="size-4 -scale-x-100" aria-hidden />
                  {t("routeFromHere")}
                </Button>
              </div>
              <div className="flex justify-end gap-1 border-t pt-2">
                {confirmDelete === p.id ? (
                  <>
                    <span className="mr-auto self-center text-sm">{t("deletePlaceConfirm")}</span>
                    <Button variant="ghost" className="h-11 rounded-xl" onClick={() => setConfirmDelete(null)}>
                      {t("cancel")}
                    </Button>
                    <Button variant="destructive" className="h-11 rounded-xl" onClick={() => remove(p.id)} disabled={pendingId === p.id}>
                      {pendingId === p.id ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
                      {t("delete")}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" className="h-11 rounded-xl" onClick={() => setDraft(draftFrom(p, p.name))}>
                      <Pencil aria-hidden />
                      {t("edit")}
                    </Button>
                    <Button variant="ghost" className="h-11 rounded-xl text-destructive" onClick={() => setConfirmDelete(p.id)}>
                      <Trash2 aria-hidden />
                      {t("delete")}
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </ViewShell>
  );
}
