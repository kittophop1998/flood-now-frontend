"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LocationField, type LocationValue } from "@/components/community/location-field";
import { ImagePicker } from "@/components/report/image-picker";
import { useImageUpload } from "@/features/reports/use-image-upload";
import { EVENT_CATEGORY_META, EVENT_COLOR } from "@/lib/community-meta";
import { eventWindowError, fromLocalInput, toLocalInput } from "@/lib/events";
import { imageKitUrl } from "@/lib/imagekit";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { EVENT_CATEGORIES, type CommunityEvent, type EventCategory, type EventInput, type LatLng } from "@/types/community";

export interface EventDraft {
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
  // Photo picked before the form was left to choose a point on the map.
  imageFile: File | null;
}

export function draftFrom(ev: CommunityEvent | null, now: Date, location: LocationValue | null = null): EventDraft {
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
      imageFile: null,
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
    location,
    locationName: "",
    description: "",
    existingImageKey: null,
    imageFile: null,
  };
}

// The community event create/edit form: used by the create-report drawer
// (new events) and the events screen (editing your own). The parent decides
// what saving does (the API call) and what happens next.
export function EventForm({
  initial,
  onSave,
  onCancel,
  onUseMyLocation,
  onPickOnMap,
  error,
}: {
  initial: EventDraft;
  // Resolves to whether it was saved; the form stays open (input intact) if not.
  onSave: (id: string | null, body: EventInput) => Promise<boolean>;
  onCancel: () => void;
  onUseMyLocation: () => Promise<LatLng | null>;
  // Pick the point on the map; gets the form's current state to restore.
  onPickOnMap: (draft: EventDraft) => void;
  error: string | null;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<"title" | "category" | "window" | "location", string>>>({});
  const [saving, setSaving] = useState(false);
  const image = useImageUpload(initial.imageFile);

  async function save() {
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
    const saved = await onSave(draft.id, body);
    setSaving(false);
    if (saved) image.remove();
  }

  const existingUrl = draft.existingImageKey && image.state.status === "empty" ? imageKitUrl(draft.existingImageKey) : null;
  return (
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
        onPickOnMap={() => onPickOnMap({ ...draft, imageFile: "file" in image.state ? image.state.file : null })}
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

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="outline" className="h-12 flex-1 rounded-xl" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button className="h-12 flex-1 rounded-xl" onClick={save} disabled={saving || image.state.status === "uploading"}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {draft.id ? t("eventSave") : t("eventPublish")}
        </Button>
      </div>
    </section>
  );
}
