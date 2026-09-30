"use client";

import { useState } from "react";
import { Loader2, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailPopup } from "@/components/ui/detail-popup";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EventForm, type EventDraft } from "@/components/community/event-form";
import { useManageEvent } from "@/features/events/use-events";
import { EVENT_COLOR } from "@/lib/community-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { CommunityEvent, EventInput, LatLng } from "@/types/community";

// Organizer's edit popup for one of their events, opened from its map popup:
// every field but the photo, plus cancel / delete. The API authorizes it all.
export function EventEditPopup({
  draft,
  onClose,
  onSaved,
  onCancelled,
  onDeleted,
  onUseMyLocation,
  onPickOnMap,
  onVisibleHeightChange,
}: {
  // Seeded from the event; `draft.id` is the event's id.
  draft: EventDraft;
  onClose: () => void;
  onSaved: (event: CommunityEvent) => void;
  onCancelled: (event: CommunityEvent) => void;
  onDeleted: () => void;
  onUseMyLocation: () => Promise<LatLng | null>;
  // Pick the point on the map; gets the form's current state to restore.
  onPickOnMap: (draft: EventDraft) => void;
  onVisibleHeightChange?: (px: number) => void;
}) {
  const { t } = useTranslation();
  const manage = useManageEvent();
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const id = draft.id!;
  const headingId = `event-edit-${id}-title`;

  async function save(_id: string | null, body: EventInput) {
    const saved = await manage.update(id, body);
    if (!saved) return false;
    onSaved(saved);
    return true;
  }

  async function act(kind: "cancel" | "delete") {
    setBusy(true);
    if (kind === "cancel") {
      const cancelled = await manage.cancel(id);
      if (cancelled) onCancelled(cancelled);
    } else if (await manage.remove(id)) {
      onDeleted();
    }
    setBusy(false);
    setConfirm(null);
  }

  const header = (
    <div className="flex flex-col gap-1">
      <h2 id={headingId} tabIndex={-1} className="text-lg leading-snug font-semibold outline-none sm:text-xl">
        {t("eventEditTitle")}
      </h2>
      <p className="text-xs text-muted-foreground">{t("eventFormSubtitle")}</p>
    </div>
  );

  return (
    <DetailPopup labelledBy={headingId} onClose={onClose} header={header} accent={EVENT_COLOR} onVisibleHeightChange={onVisibleHeightChange}>
      <EventForm
        // Re-seed after choosing a new point on the map.
        key={`${draft.location?.latitude}:${draft.location?.longitude}`}
        initial={draft}
        onSave={save}
        onCancel={onClose}
        onUseMyLocation={onUseMyLocation}
        onPickOnMap={onPickOnMap}
        error={manage.error}
        withPhoto={false}
        className="rounded-none border-0 bg-transparent p-0 shadow-none"
      />

      <div className="flex gap-2 border-t pt-4">
        <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => setConfirm("cancel")} disabled={busy}>
          <XCircle aria-hidden />
          {t("eventCancel")}
        </Button>
        <Button variant="ghost" className="h-11 flex-1 rounded-xl text-destructive" onClick={() => setConfirm("delete")} disabled={busy}>
          <Trash2 aria-hidden />
          {t("eventDelete")}
        </Button>
      </div>

      <Dialog open={confirm != null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm === "delete" ? t("eventDeleteConfirmTitle") : t("eventCancelConfirmTitle")}</DialogTitle>
            <DialogDescription>{confirm === "delete" ? t("eventDeleteConfirmBody") : t("eventCancelConfirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setConfirm(null)}>
              {t("back")}
            </Button>
            <Button variant="destructive" className="h-11 rounded-xl" onClick={() => confirm && act(confirm)} disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {confirm === "delete" ? t("eventDelete") : t("eventCancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DetailPopup>
  );
}
