"use client";

import { useEffect, useState } from "react";
import { ChevronRight, CircleAlert, Loader2, MapPinOff, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PlaceStatusBadge, StaleDataNote, UserAddedBadge } from "@/components/community/badges";
import { LocationField, type LocationValue } from "@/components/community/location-field";
import { EmptyState, ViewShell } from "@/components/views/view-shell";
import { importantPlacesService } from "@/services/community-service";
import { ApiError, isAbortError, isNetworkError } from "@/services/api-client";
import { IMPORTANT_PLACE_META } from "@/lib/community-meta";
import { getDeviceId } from "@/lib/device-id";
import { distanceMeters, formatDistance } from "@/lib/distance";
import { readCache, writeCache } from "@/lib/offline-cache";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { LayerFilters } from "@/features/layers/use-viewport-layers";
import {
  IMPORTANT_PLACE_CATEGORIES,
  IMPORTANT_PLACE_STATUSES,
  type ImportantPlace,
  type ImportantPlaceCategory,
  type ImportantPlaceStatus,
  type LatLng,
} from "@/types/community";

const LIST_RADIUS_DEG = 0.15; // ~15 km around the map center
const CACHE_KEY = "important-places-list";

const optionClass =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const optionOn = "border-primary bg-accent text-primary";
const optionOff = "bg-background hover:bg-muted";

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

interface Draft {
  id: string | null;
  name: string;
  category: ImportantPlaceCategory;
  status: ImportantPlaceStatus;
  location: LocationValue | null;
  address: string;
  contact: string;
  description: string;
}

function draftFrom(place: ImportantPlace | null): Draft {
  return place
    ? {
        id: place.id,
        name: place.name,
        category: place.category,
        status: place.status,
        location: { latitude: place.latitude, longitude: place.longitude, label: place.name },
        address: place.address ?? "",
        contact: place.contact ?? "",
        description: place.description ?? "",
      }
    : { id: null, name: "", category: "shelter", status: "open", location: null, address: "", contact: "", description: "" };
}

// Important places (hospitals, shelters, boat points…) around the map
// center, filterable by category/status; opening one shows it on the map.
// Anyone can add a place; this device can edit/delete the ones it added.
export function ImportantPlacesView({
  center,
  layers,
  onLayersChange,
  onOpen,
  onChanged,
  onUseMyLocation,
  onPick,
  onBack,
  hidden,
}: {
  center: LatLng;
  layers: LayerFilters;
  onLayersChange: (next: LayerFilters) => void;
  onOpen: (place: ImportantPlace) => void;
  // Called after this device adds/edits/deletes a place (e.g. refresh the map layer).
  onChanged: () => void;
  onUseMyLocation: () => Promise<LatLng | null>;
  onPick: (title: string, onPick: (p: LatLng) => void) => void;
  onBack: () => void;
  hidden?: boolean;
}) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<ImportantPlaceCategory[]>(layers.placeCategories);
  const [statuses, setStatuses] = useState<ImportantPlaceStatus[]>(layers.placeStatuses);
  const [places, setPlaces] = useState<ImportantPlace[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [staleSince, setStaleSince] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; location?: string; form?: string }>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const key = `${center.latitude.toFixed(2)},${center.longitude.toFixed(2)}|${categories}|${statuses}`;

  function failureText(err: unknown) {
    if (err instanceof ApiError && err.code === "RATE_LIMITED") return t("ipTooMany");
    return err instanceof ApiError && err.status !== 0 ? err.message : t("placeSaveFailed");
  }

  async function save() {
    if (!draft) return;
    const next: typeof errors = {};
    if (!draft.name.trim()) next.name = t("placeNameRequired");
    if (!draft.location) next.location = t("placeLocationRequired");
    setErrors(next);
    if (next.name || next.location) return;
    setSaving(true);
    // "" clears an optional field on edit; on create it's simply left out.
    const body = {
      name: draft.name.trim(),
      category: draft.category,
      status: draft.status,
      latitude: draft.location!.latitude,
      longitude: draft.location!.longitude,
      address: draft.address.trim(),
      contact: draft.contact.trim(),
      description: draft.description.trim(),
    };
    try {
      const deviceId = getDeviceId();
      const saved = draft.id
        ? await importantPlacesService.update(deviceId, draft.id, body)
        : await importantPlacesService.create(deviceId, body);
      setPlaces((list) => [saved, ...list.filter((p) => p.id !== saved.id)]);
      setDraft(null);
      onChanged();
      if (!draft.id) onOpen(saved);
    } catch (err) {
      setErrors({ form: failureText(err) });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setPendingId(id);
    try {
      await importantPlacesService.remove(getDeviceId(), id);
      setPlaces((list) => list.filter((p) => p.id !== id));
      setConfirmDelete(null);
      onChanged();
    } catch (err) {
      setErrors({ form: failureText(err) });
    } finally {
      setPendingId(null);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const bbox = {
      minLat: center.latitude - LIST_RADIUS_DEG,
      maxLat: center.latitude + LIST_RADIUS_DEG,
      minLng: center.longitude - LIST_RADIUS_DEG,
      maxLng: center.longitude + LIST_RADIUS_DEG,
    };
    importantPlacesService
      .list({ bbox, categories, statuses, deviceId: getDeviceId() }, controller.signal)
      .then((res) => {
        setPlaces(res.places);
        writeCache(CACHE_KEY, res.places);
        setStaleSince(null);
        setStatus("ready");
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        const cached = isNetworkError(err) ? readCache<ImportantPlace[]>(CACHE_KEY) : null;
        if (cached) {
          setPlaces(cached.data);
          setStaleSince(cached.savedAt);
          setStatus("ready");
        } else setStatus("error");
      });
    return () => controller.abort();
    // `key` captures center/categories/statuses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retry]);

  const sorted = [...places].sort((a, b) => distanceMeters(center, a) - distanceMeters(center, b));

  return (
    <ViewShell title={t("importantPlacesTitle")} subtitle={t("importantPlacesSubtitle")} onBack={onBack} hidden={hidden}>
      <div className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-2 shadow-xs">
        <Label htmlFor="layer-places" className="font-medium">
          {t("layerPlacesToggle")}
        </Label>
        <Switch id="layer-places" checked={layers.places} onCheckedChange={(v) => onLayersChange({ ...layers, places: v, placeCategories: categories, placeStatuses: statuses })} />
      </div>

      {draft ? (
        <section aria-labelledby="ip-form-title" className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-xs">
          <div>
            <h2 id="ip-form-title" className="font-semibold">
              {draft.id ? t("editPlace") : t("ipAddPlace")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("ipAddHint")}</p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">{t("ipCategoryLabel")}</legend>
            <div role="radiogroup" aria-label={t("ipCategoryLabel")} className="grid grid-cols-3 gap-2">
              {IMPORTANT_PLACE_CATEGORIES.map((c) => {
                const meta = IMPORTANT_PLACE_META[c];
                const on = draft.category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setDraft({ ...draft, category: c })}
                    className={cn(optionClass, "flex-col px-1 py-2 text-xs", on ? optionOn : optionOff)}
                  >
                    <meta.icon className="size-5" style={on ? undefined : { color: meta.color }} aria-hidden />
                    {t(`ipCategory.${c}`)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-1.5">
            <Label htmlFor="ip-name">{t("placeNameLabel")}</Label>
            <Input
              id="ip-name"
              className="h-11 text-base"
              maxLength={120}
              value={draft.name}
              aria-invalid={!!errors.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <LocationField
            label={t("placeLocationLabel")}
            labelId="ip-location"
            value={draft.location}
            onChange={(location) => setDraft({ ...draft, location })}
            onUseMyLocation={onUseMyLocation}
            onPickOnMap={() => onPick(t("pickPlaceTitle"), (p) => setDraft((d) => (d ? { ...d, location: p } : d)))}
            searchable
            invalid={!!errors.location}
          />
          {errors.location && <p className="-mt-2 text-sm text-destructive">{errors.location}</p>}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">{t("ipStatusLabel")}</legend>
            <div role="radiogroup" aria-label={t("ipStatusLabel")} className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-4">
              {IMPORTANT_PLACE_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={draft.status === s}
                  onClick={() => setDraft({ ...draft, status: s })}
                  className={cn(optionClass, draft.status === s ? optionOn : optionOff)}
                >
                  {t(`ipStatus.${s}`)}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-1.5">
            <Label htmlFor="ip-address">
              {t("ipAddressLabel")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
            </Label>
            <Input id="ip-address" className="h-11 text-base" maxLength={300} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ip-contact">
              {t("ipContactLabel")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
            </Label>
            <Input
              id="ip-contact"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              className="h-11 text-base"
              maxLength={120}
              value={draft.contact}
              onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ip-description">
              {t("ipDescriptionLabel")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
            </Label>
            <Textarea
              id="ip-description"
              className="min-h-20 text-base"
              maxLength={2000}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>

          {errors.form && (
            <p role="alert" className="text-sm text-destructive">
              {errors.form}
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
        <Button
          className="h-12 rounded-xl text-base"
          onClick={() => {
            setErrors({});
            setDraft(draftFrom(null));
          }}
        >
          <Plus aria-hidden />
          {t("ipAddPlace")}
        </Button>
      )}
      {!draft && errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1" role="group" aria-label={t("filterCategories")}>
          {IMPORTANT_PLACE_CATEGORIES.map((c) => {
            const meta = IMPORTANT_PLACE_META[c];
            const on = categories.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setCategories(toggle(categories, c))}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                )}
              >
                <meta.icon className="size-4" style={on ? undefined : { color: meta.color }} aria-hidden />
                {t(`ipCategory.${c}`)}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("filterStatus")}>
          {IMPORTANT_PLACE_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={statuses.includes(s)}
              onClick={() => setStatuses(toggle(statuses, s))}
              className={cn(
                "min-h-11 rounded-xl border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
                statuses.includes(s) ? "border-primary bg-accent text-primary" : "bg-background hover:bg-muted",
              )}
            >
              {t(`ipStatus.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {staleSince && <StaleDataNote savedAt={staleSince} />}
      <div aria-live="polite" className="flex flex-col gap-2">
        {status === "loading" && [0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-background" aria-hidden />)}
        {status === "error" && (
          <EmptyState
            icon={<CircleAlert />}
            title={t("importantPlacesFailed")}
            action={
              <Button variant="outline" className="mt-2 h-11 rounded-xl" onClick={() => setRetry((n) => n + 1)}>
                {t("retry")}
              </Button>
            }
          />
        )}
        {status === "ready" && sorted.length === 0 && <EmptyState icon={<MapPinOff />} title={t("noImportantPlaces")} hint={t("noImportantPlacesHint")} />}
        {status === "ready" &&
          sorted.map((p) => {
            const meta = IMPORTANT_PLACE_META[p.category];
            const row = (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpen(p)}
                className={cn(
                  "flex items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  p.mine ? "rounded-xl" : "rounded-2xl border bg-card p-3.5 shadow-xs hover:bg-muted/50",
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: meta.color }}>
                  <meta.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <PlaceStatusBadge status={p.status} />
                    {p.origin === "community" && <UserAddedBadge mine={p.mine} />}
                    {t(`ipCategory.${p.category}`)} · {t("distanceAway", { d: formatDistance(distanceMeters(center, p), t) })}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            );
            if (!p.mine) return row;
            return (
              <div key={p.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-3.5 shadow-xs">
                {row}
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
                      <Button
                        variant="ghost"
                        className="h-11 rounded-xl"
                        onClick={() => {
                          setErrors({});
                          setDraft(draftFrom(p));
                        }}
                      >
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
              </div>
            );
          })}
      </div>
    </ViewShell>
  );
}
