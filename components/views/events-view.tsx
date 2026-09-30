"use client";

import { useState } from "react";
import { CalendarDays, CircleAlert, Clock, Loader2, MapPin, Pencil, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EventForm, draftFrom, type EventDraft } from "@/components/community/event-form";
import { EventStatusBadge } from "@/components/layers/layer-detail";
import { EmptyState, ViewShell } from "@/components/views/view-shell";
import { useAuth } from "@/features/auth/auth-provider";
import { useNow } from "@/features/common/use-now";
import { useEvents } from "@/features/events/use-events";
import { EVENT_CATEGORY_META, EVENT_COLOR } from "@/lib/community-meta";
import { eventStatus, visibleEvents } from "@/lib/events";
import { formatClockTime } from "@/lib/freshness";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { CommunityEvent, EventInput, LatLng } from "@/types/community";
import type { BoundingBox } from "@/types/report";

type PickFn = (title: string, onPick: (p: LatLng) => void) => void;

// Community events (fairs, markets, walking streets…): browse what's on
// around the map; signed-in people manage their own (new events are posted
// from the create-report drawer).
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
  const { user } = useAuth();
  const now = useNow();
  const [draft, setDraft] = useState<EventDraft | null>(() => (initialEdit ? draftFrom(initialEdit, new Date()) : null));
  // Bumped to re-seed the form after choosing a point on the map.
  const [formKey, setFormKey] = useState(0);
  const [confirm, setConfirm] = useState<{ kind: "cancel" | "delete"; event: CommunityEvent } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const events = useEvents(bbox);

  const list = visibleEvents(events.nearby, now);

  function startEdit(ev: CommunityEvent) {
    setDraft(draftFrom(ev, now));
  }

  async function saveEvent(id: string | null, body: EventInput) {
    const saved = id ? await events.update(id, body) : await events.create(body);
    if (!saved) return false;
    setDraft(null);
    onChanged();
    onOpen(saved);
    return true;
  }

  async function act(kind: "cancel" | "delete", ev: CommunityEvent) {
    setBusyId(ev.id);
    const ok = kind === "cancel" ? await events.cancel(ev.id) : await events.remove(ev.id);
    setBusyId(null);
    setConfirm(null);
    if (ok) onChanged();
  }

  if (draft) {
    return (
      <ViewShell title={t("eventEditTitle")} subtitle={t("eventFormSubtitle")} onBack={() => setDraft(null)} hidden={hidden}>
        <EventForm
          key={formKey}
          initial={draft}
          onSave={saveEvent}
          onCancel={() => setDraft(null)}
          onUseMyLocation={onUseMyLocation}
          onPickOnMap={(d) =>
            onPick(t("eventPickLocation"), (p) => {
              setDraft({ ...d, location: p });
              setFormKey((k) => k + 1);
            })
          }
          error={events.actionError}
        />
      </ViewShell>
    );
  }

  return (
    <ViewShell title={t("eventsTitle")} subtitle={t("eventsSubtitle")} onBack={onBack} hidden={hidden}>
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
