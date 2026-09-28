"use client";

import { useState } from "react";
import { CalendarDays, CalendarPlus, CircleAlert, Clock, Loader2, MapPin, Pencil, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LocationField, type LocationValue } from "@/components/community/location-field";
import { ImagePicker } from "@/components/report/image-picker";
import { EventStatusBadge } from "@/components/layers/layer-detail";
import { EmptyState, ViewShell } from "@/components/views/view-shell";
import { useAuth } from "@/features/auth/auth-provider";
import { useNow } from "@/features/common/use-now";
import { useEvents } from "@/features/events/use-events";
import { useImageUpload } from "@/features/reports/use-image-upload";
import { EVENT_CATEGORY_META, EVENT_COLOR } from "@/lib/community-meta";
import { eventStatus, eventWindowError, fromLocalInput, toLocalInput, visibleEvents } from "@/lib/events";
import { imageKitUrl } from "@/lib/imagekit";
import { formatClockTime } from "@/lib/freshness";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { EVENT_CATEGORIES, type CommunityEvent, type EventCategory, type EventInput, type LatLng } from "@/types/community";
import type { BoundingBox } from "@/types/report";

type PickFn = (title: string, onPick: (p: LatLng) => void) => void;

interface Draft {
  id: string | null;
  title: string;
  category: EventCategory | null;
  start: string; // datetime-local
  end: string;
  location: LocationValue | null;
  locationName: string;
  description: string;
  // Photo already on the event (edit); a newly picked one replaces it.
  existingImageKey: string | null;
}

function draftFrom(ev: CommunityEvent | null, now: Date): Draft {
  if (ev) {
    return {
      id: ev.id,
      title: ev.title,
      category: ev.category,
      start: toLocalInput(ev.start_at),
      end: toLocalInput(ev.end_at),
      location: { latitude: ev.latitude, longitude: ev.longitude, label: ev.location_name ?? ev.title },
      locationName: ev.location_name ?? "",
      description: ev.description ?? "",
      existingImageKey: ev.image_key,
    };
  }
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 4 * 3600 * 1000);
  return {
    id: null,
    title: "",
    category: null,
    start: toLocalInput(start),
    end: toLocalInput(end),
    location: null,
    locationName: "",
    description: "",
    existingImageKey: null,
  };
}

// Community events (fairs, markets, walking streets…): browse what's on
// around the map; signed-in people create events and manage their own.
// Events are public content, never incidents — no votes or alerts.
export function EventsView({
  bbox,
  initialEdit,
  onBack,
  hidden,
  onOpen,
  onUseMyLocation,
  onPick,
  onChanged,
}: {
  // The map viewport: the list shows events around it.
  bbox: BoundingBox | null;
  // Opened from an event's "manage" button: start in its edit form.
  initialEdit: CommunityEvent | null;
  onBack: () => void;
  hidden?: boolean;
  onOpen: (event: CommunityEvent) => void;
  onUseMyLocation: () => Promise<LatLng | null>;
  onPick: PickFn;
  // An event was created/edited/cancelled/deleted (refresh the map layer).
  onChanged: () => void;
}) {
  const { t, locale } = useTranslation();
  const { user, requireAuth } = useAuth();
  const now = useNow();
  const [draft, setDraft] = useState<Draft | null>(() => (initialEdit ? draftFrom(initialEdit, new Date()) : null));
  const [errors, setErrors] = useState<Partial<Record<"title" | "category" | "window" | "location", string>>>({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "cancel" | "delete"; event: CommunityEvent } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const image = useImageUpload();
  const events = useEvents(bbox);

  const list = visibleEvents(events.nearby, now);

  function startCreate() {
    requireAuth("createEvent", () => {
      image.remove();
      setErrors({});
      setDraft(draftFrom(null, new Date()));
    });
  }

  function startEdit(ev: CommunityEvent) {
    image.remove();
    setErrors({});
    setDraft(draftFrom(ev, now));
  }

  async function save() {
    if (!draft) return;
    const start = fromLocalInput(draft.start);
    const end = fromLocalInput(draft.end);
    const next: typeof errors = {};
    if (!draft.title.trim()) next.title = t("eventTitleRequired");
    if (!draft.category) next.category = t("eventCategoryRequired");
    if (!draft.location) next.location = t("eventLocationRequired");
    const windowError = eventWindowError(start, end, new Date());
    if (windowError) next.window = t(`eventWindow.${windowError}`);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (image.state.status === "uploading" || image.state.status === "failed") return;

    const body: EventInput = {
      title: draft.title.trim(),
      category: draft.category!,
      latitude: draft.location!.latitude,
      longitude: draft.location!.longitude,
      location_name: draft.locationName.trim(),
      description: draft.description.trim(),
      start_at: start!.toISOString(),
      end_at: end!.toISOString(),
    };
    if (image.state.status === "uploaded") body.image_key = image.state.objectKey;
    else if (!draft.existingImageKey) body.image_key = "";

    setSaving(true);
    const saved = draft.id ? await events.update(draft.id, body) : await events.create(body);
    setSaving(false);
    if (saved) {
      setDraft(null);
      image.remove();
      onChanged();
      onOpen(saved);
    }
  }

  async function act(kind: "cancel" | "delete", ev: CommunityEvent) {
    setBusyId(ev.id);
    const ok = kind === "cancel" ? await events.cancel(ev.id) : await events.remove(ev.id);
    setBusyId(null);
    setConfirm(null);
    if (ok) onChanged();
  }

  if (draft) {
    const existingUrl = draft.existingImageKey && image.state.status === "empty" ? imageKitUrl(draft.existingImageKey) : null;
    return (
      <ViewShell title={draft.id ? t("eventEditTitle") : t("eventCreateTitle")} subtitle={t("eventFormSubtitle")} onBack={() => setDraft(null)} hidden={hidden}>
        <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-xs">
          <div className="grid gap-1.5">
            <Label htmlFor="event-title">{t("eventTitleLabel")}</Label>
            <Input
              id="event-title"
              maxLength={120}
              className="h-11 text-base"
              value={draft.title}
              aria-invalid={!!errors.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
          </div>

          <div className="grid gap-1.5">
            <p id="event-category" className="text-sm font-medium">
              {t("eventCategoryLabel")}
            </p>
            <div role="radiogroup" aria-labelledby="event-category" className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
              {EVENT_CATEGORIES.map((c) => {
                const Icon = EVENT_CATEGORY_META[c] ?? EVENT_CATEGORY_META.other;
                const on = draft.category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setDraft({ ...draft, category: c })}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      on ? "border-fuchsia-600 bg-fuchsia-50 text-fuchsia-900" : "bg-background hover:bg-muted",
                    )}
                  >
                    <Icon className="size-4 shrink-0" style={{ color: EVENT_COLOR }} aria-hidden />
                    {t(`eventCategory.${c}`)}
                  </button>
                );
              })}
            </div>
            {errors.category && <p className="text-sm text-destructive">{errors.category}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="event-start">{t("eventStarts")}</Label>
              <Input id="event-start" type="datetime-local" className="h-11 text-base" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="event-end">{t("eventEnds")}</Label>
              <Input id="event-end" type="datetime-local" className="h-11 text-base" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
            </div>
            {errors.window && <p className="text-sm text-destructive min-[420px]:col-span-2">{errors.window}</p>}
          </div>

          <LocationField
            label={t("eventLocation")}
            labelId="event-location"
            value={draft.location}
            // Functional: "My location" resolves after other fields may have changed.
            onChange={(location) => setDraft((d) => (d ? { ...d, location } : d))}
            onUseMyLocation={onUseMyLocation}
            onPickOnMap={() => onPick(t("eventPickLocation"), (p) => setDraft((d) => (d ? { ...d, location: p } : d)))}
            searchable
            invalid={!!errors.location}
          />
          {errors.location && <p className="text-sm text-destructive">{errors.location}</p>}

          <div className="grid gap-1.5">
            <Label htmlFor="event-place-name">
              {t("eventLocationName")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
            </Label>
            <Input
              id="event-place-name"
              maxLength={200}
              className="h-11 text-base"
              placeholder={t("eventLocationNamePlaceholder")}
              value={draft.locationName}
              onChange={(e) => setDraft({ ...draft, locationName: e.target.value })}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="event-description">
              {t("eventDescription")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
            </Label>
            <Textarea
              id="event-description"
              rows={3}
              maxLength={2000}
              className="text-base"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>

          <div className="grid gap-1.5">
            <p className="text-sm font-medium">
              {t("eventPhoto")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
            </p>
            {existingUrl && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={existingUrl} alt="" className="max-h-48 w-full rounded-xl object-cover" />
                <Button type="button" variant="outline" className="absolute top-2 right-2 h-9 rounded-lg bg-background/90" onClick={() => setDraft({ ...draft, existingImageKey: null })}>
                  <Trash2 aria-hidden />
                  {t("eventRemovePhoto")}
                </Button>
              </div>
            )}
            {!existingUrl && <ImagePicker state={image.state} onSelect={image.select} onRetry={image.retry} onRemove={image.remove} />}
          </div>

          {events.actionError && (
            <p role="alert" className="text-sm text-destructive">
              {events.actionError}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="h-12 flex-1 rounded-xl" onClick={() => setDraft(null)}>
              {t("cancel")}
            </Button>
            <Button className="h-12 flex-1 rounded-xl" onClick={save} disabled={saving || image.state.status === "uploading"}>
              {saving && <Loader2 className="animate-spin" aria-hidden />}
              {draft.id ? t("eventSave") : t("eventPublish")}
            </Button>
          </div>
        </section>
      </ViewShell>
    );
  }

  return (
    <ViewShell title={t("eventsTitle")} subtitle={t("eventsSubtitle")} onBack={onBack} hidden={hidden}>
      <Button className="h-12 rounded-xl text-base" onClick={startCreate}>
        <CalendarPlus aria-hidden />
        {t("eventCreate")}
      </Button>

      {user && events.mine.length > 0 && (
        <section aria-labelledby="my-events" className="flex flex-col gap-2">
          <h2 id="my-events" className="text-sm font-semibold text-muted-foreground">
            {t("eventMine")}
          </h2>
          <ul className="flex flex-col gap-2">
            {events.mine.map((ev) => {
              const status = eventStatus(ev, now);
              return (
                <li key={ev.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-3 shadow-xs">
                  <EventRow event={ev} now={now} locale={locale} onOpen={() => onOpen(ev)} />
                  {status === "active" && (
                    <div className="flex gap-2">
                      <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => startEdit(ev)} disabled={busyId === ev.id}>
                        <Pencil aria-hidden />
                        {t("eventEdit")}
                      </Button>
                      <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => setConfirm({ kind: "cancel", event: ev })} disabled={busyId === ev.id}>
                        <XCircle aria-hidden />
                        {t("eventCancel")}
                      </Button>
                    </div>
                  )}
                  <Button variant="ghost" className="h-11 rounded-xl text-destructive" onClick={() => setConfirm({ kind: "delete", event: ev })} disabled={busyId === ev.id}>
                    {busyId === ev.id ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
                    {t("eventDelete")}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="events-nearby" className="flex flex-col gap-2">
        <h2 id="events-nearby" className="text-sm font-semibold text-muted-foreground">
          {t("eventsInArea")}
        </h2>
        {events.nearbyStatus === "loading" && list.length === 0 && <div className="h-20 animate-pulse rounded-2xl bg-background" aria-hidden />}
        {events.nearbyStatus === "error" && (
          <EmptyState
            icon={<CircleAlert />}
            title={t("eventsLoadFailed")}
            action={
              <Button variant="outline" className="mt-2 h-11 rounded-xl" onClick={events.reload}>
                {t("retry")}
              </Button>
            }
          />
        )}
        {events.nearbyStatus === "ready" && list.length === 0 && <EmptyState icon={<CalendarDays />} title={t("eventsNone")} hint={t("eventsNoneHint")} />}
        <ul className="flex flex-col gap-2">
          {list.map((ev) => (
            <li key={ev.id} className="rounded-2xl border bg-card p-3 shadow-xs">
              <EventRow event={ev} now={now} locale={locale} onOpen={() => onOpen(ev)} />
            </li>
          ))}
        </ul>
      </section>

      <Dialog open={confirm != null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.kind === "delete" ? t("eventDeleteConfirmTitle") : t("eventCancelConfirmTitle")}</DialogTitle>
            <DialogDescription>{confirm?.kind === "delete" ? t("eventDeleteConfirmBody") : t("eventCancelConfirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setConfirm(null)}>
              {t("back")}
            </Button>
            <Button variant="destructive" className="h-11 rounded-xl" onClick={() => confirm && act(confirm.kind, confirm.event)} disabled={busyId != null}>
              {busyId && <Loader2 className="animate-spin" aria-hidden />}
              {confirm?.kind === "delete" ? t("eventDelete") : t("eventCancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ViewShell>
  );
}

function EventRow({ event: ev, now, locale, onOpen }: { event: CommunityEvent; now: Date; locale: "th" | "en"; onOpen: () => void }) {
  const Icon = EVENT_CATEGORY_META[ev.category] ?? EVENT_CATEGORY_META.other;
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: EVENT_COLOR }}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <EventStatusBadge event={ev} now={now} />
        </span>
        <span className="mt-1 block font-semibold break-words">{ev.title}</span>
        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          {formatClockTime(ev.start_at, locale, now)} – {formatClockTime(ev.end_at, locale, now)}
        </span>
        {ev.location_name && (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{ev.location_name}</span>
          </span>
        )}
      </span>
    </button>
  );
}
