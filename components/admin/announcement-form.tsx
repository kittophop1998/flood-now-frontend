"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  CalendarClock,
  CircleAlert,
  Eye,
  FileText,
  ImagePlus,
  Images,
  Loader2,
  MapPin,
  RotateCw,
  Send,
  Star,
  Tags,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CoordinatePickerButton } from "@/components/admin/coordinate-picker";
import { AnnouncementPopup } from "@/components/layers/layer-detail";
import { useAnnouncementImages, type AnnouncementImageItem } from "@/features/admin/use-announcement-images";
import { useApproximateAddress } from "@/features/reports/use-location-lookups";
import { adminService } from "@/services/admin-service";
import { ApiError } from "@/services/api-client";
import {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_RADIUS_MAX_M,
  ANNOUNCEMENT_RADIUS_MIN_M,
  ANNOUNCEMENT_SOURCE_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  draftFromAnnouncement,
  draftPoint,
  draftToInput,
  effectiveStart,
  emptyDraft,
  hasArea,
  publishChange,
  toLocalInput,
  validateDraft,
  type AnnouncementDraft,
  type DraftField,
  type PublishMode,
} from "@/lib/announcement-form";
import { ANNOUNCEMENT_RADIUS_PRESETS_M, ANNOUNCEMENT_SEVERITY_META } from "@/lib/community-meta";
import { AnnouncementTypeIcon } from "@/components/community/badges";
import { formatDistance } from "@/lib/distance";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/report-schema";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { ANNOUNCEMENT_SEVERITIES, ANNOUNCEMENT_TYPES, MAX_ANNOUNCEMENT_IMAGES, type Announcement } from "@/types/community";

const inputClass = "h-11 text-base md:text-sm";
const selectClass =
  "h-11 w-full appearance-none rounded-lg border border-input bg-background pr-8 pl-10 text-base focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

const PUBLISH_MODES: { id: PublishMode; label: "annModeDraft" | "annModeNow" | "annModeSchedule"; hint: "annModeDraftHint" | "annModeNowHint" | "annModeScheduleHint" }[] = [
  { id: "draft", label: "annModeDraft", hint: "annModeDraftHint" },
  { id: "now", label: "annModeNow", hint: "annModeNowHint" },
  { id: "schedule", label: "annModeSchedule", hint: "annModeScheduleHint" },
];

// Create/edit form for an official announcement (any year-round notice type,
// not only floods). Mount with key={editing?.id ?? "new"} so switching
// records resets it.
export function AnnouncementForm({
  token,
  editing,
  onSaved,
  onCancelEdit,
}: {
  token: string;
  editing: Announcement | null;
  onSaved: () => void;
  onCancelEdit: () => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const [draft, setDraft] = useState<AnnouncementDraft>(() => (editing ? draftFromAnnouncement(editing, new Date()) : emptyDraft(new Date())));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const images = useAnnouncementImages(token, editing?.images);
  const formRef = useRef<HTMLFormElement>(null);

  const errors = submitted ? validateDraft(draft, new Date()) : {};
  const set = <K extends keyof AnnouncementDraft>(key: K, value: AnnouncementDraft[K]) => {
    setFormError(null);
    setDraft((d) => ({ ...d, [key]: value }));
  };
  const err = (field: DraftField) => (errors[field] ? t(errors[field]) : undefined);

  function setMode(mode: PublishMode) {
    setDraft((d) => {
      const now = new Date();
      const start = d.starts_at ? new Date(d.starts_at) : null;
      if (mode === "now" && (!start || start > now)) return { ...d, mode, starts_at: toLocalInput(now.toISOString()) };
      if (mode === "schedule" && (!start || start <= now)) {
        const next = new Date(now.getTime() + 60 * 60 * 1000);
        next.setMinutes(0, 0, 0);
        return { ...d, mode, starts_at: toLocalInput(next.toISOString()) };
      }
      return { ...d, mode };
    });
  }

  async function submit() {
    setSubmitted(true);
    setFormError(null);
    const now = new Date();
    const found = validateDraft(draft, now);
    if (Object.keys(found).length > 0) {
      setFormError(t("annErrFix"));
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    if (images.pending) {
      setFormError(t("annImagesPending"));
      return;
    }
    setSaving(true);
    const api = adminService(token);
    try {
      const input = draftToInput(draft, images.uploaded, now, editing ?? undefined);
      if (editing) {
        await api.updateAnnouncement(editing.id, input);
        const change = publishChange(draft, editing);
        if (change != null) await api.setPublished(editing.id, change);
      } else {
        await api.createAnnouncement(input);
      }
      toast.success(t("adminDone"));
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.status !== 0) {
        const fields = e.fields ? Object.entries(e.fields).map(([k, v]) => `${k}: ${v}`) : [];
        setFormError([e.message, ...fields].join(" · "));
      } else {
        setFormError(t("adminUnreachable"));
      }
    } finally {
      setSaving(false);
    }
  }

  const cta = draft.mode === "draft" ? t("annSaveDraft") : draft.mode === "schedule" ? t("annScheduleCta") : t("annPublishCta");
  const SeverityIcon = ANNOUNCEMENT_SEVERITY_META[draft.severity].icon;

  return (
    <form
      ref={formRef}
      noValidate
      aria-labelledby={`${formId}-title`}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <header className="flex flex-col gap-1 px-1">
        <h2 id={`${formId}-title`} className="text-lg font-semibold">
          {editing ? t("annFormEditTitle") : t("annFormCreateTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("annFormIntro")}</p>
      </header>

      <Section icon={FileText} title={t("annSecContent")}>
        <Field id={`${formId}-title-input`} label={t("annFieldTitle")} required error={err("title")} counter={[draft.title.length, ANNOUNCEMENT_TITLE_MAX]}>
          <Input
            id={`${formId}-title-input`}
            className={inputClass}
            maxLength={ANNOUNCEMENT_TITLE_MAX}
            placeholder={t("annTitlePlaceholder")}
            value={draft.title}
            aria-invalid={!!errors.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>
        <Field id={`${formId}-body`} label={t("annFieldBody")} required error={err("body")} counter={[draft.body.length, ANNOUNCEMENT_BODY_MAX]}>
          <Textarea
            id={`${formId}-body`}
            rows={5}
            maxLength={ANNOUNCEMENT_BODY_MAX}
            className="min-h-32 text-base md:text-sm"
            placeholder={t("annBodyPlaceholder")}
            value={draft.body}
            aria-invalid={!!errors.body}
            onChange={(e) => set("body", e.target.value)}
          />
        </Field>
      </Section>

      <Section icon={Tags} title={t("annSecClassify")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id={`${formId}-type`} label={t("annFieldCategory")} required>
            <div className="relative">
              <AnnouncementTypeIcon type={draft.type} className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-indigo-700" />
              <select id={`${formId}-type`} className={selectClass} value={draft.type} onChange={(e) => set("type", e.target.value as AnnouncementDraft["type"])}>
                {ANNOUNCEMENT_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {t(`annType.${v}`)}
                  </option>
                ))}
              </select>
            </div>
          </Field>
          <Field id={`${formId}-severity`} label={t("annFieldSeverity")} required>
            <div className="relative">
              <SeverityIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <select
                id={`${formId}-severity`}
                className={selectClass}
                value={draft.severity}
                onChange={(e) => set("severity", e.target.value as AnnouncementDraft["severity"])}
              >
                {ANNOUNCEMENT_SEVERITIES.map((v) => (
                  <option key={v} value={v}>
                    {t(`annSeverity.${v}`)}
                  </option>
                ))}
              </select>
            </div>
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">{t("annSeverityHint")}</p>
      </Section>

      <Section icon={BadgeCheck} title={t("annSecSource")} hint={t("annSourceHint")}>
        <Field id={`${formId}-source`} label={t("annFieldSourceName")} required error={err("source_name")}>
          <Input
            id={`${formId}-source`}
            className={inputClass}
            maxLength={ANNOUNCEMENT_SOURCE_MAX}
            placeholder={t("annSourceNamePlaceholder")}
            value={draft.source_name}
            aria-invalid={!!errors.source_name}
            onChange={(e) => set("source_name", e.target.value)}
          />
        </Field>
        <Field id={`${formId}-source-url`} label={t("annFieldSourceUrl")} optional error={err("source_url")}>
          <Input
            id={`${formId}-source-url`}
            type="url"
            inputMode="url"
            className={inputClass}
            placeholder="https://"
            value={draft.source_url}
            aria-invalid={!!errors.source_url}
            onChange={(e) => set("source_url", e.target.value)}
          />
        </Field>
      </Section>

      <Section icon={MapPin} title={t("annSecArea")} optional hint={t("annAreaHint")}>
        <AreaField formId={formId} draft={draft} setDraft={setDraft} errors={{ latitude: err("latitude"), radius_m: err("radius_m") }} />
      </Section>

      <Section icon={Images} title={t("annSecImages")} optional hint={t("annImagesHint", { n: MAX_ANNOUNCEMENT_IMAGES })}>
        <ImagesField images={images} />
      </Section>

      <Section icon={CalendarClock} title={t("annSecPeriod")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id={`${formId}-start`} label={t("annFieldStart")} required error={err("starts_at")}>
            <Input
              id={`${formId}-start`}
              type="datetime-local"
              className={inputClass}
              value={draft.starts_at}
              aria-invalid={!!errors.starts_at}
              onChange={(e) => set("starts_at", e.target.value)}
            />
          </Field>
          <Field id={`${formId}-end`} label={t("annFieldEnd")} optional error={err("ends_at")} hint={t("annEndHint")}>
            <div className="flex gap-1.5">
              <Input
                id={`${formId}-end`}
                type="datetime-local"
                className={cn(inputClass, "min-w-0 flex-1")}
                value={draft.ends_at}
                min={draft.starts_at || undefined}
                aria-invalid={!!errors.ends_at}
                onChange={(e) => set("ends_at", e.target.value)}
              />
              {draft.ends_at && (
                <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 rounded-lg" aria-label={t("annClearEnd")} onClick={() => set("ends_at", "")}>
                  <X className="size-5" aria-hidden />
                </Button>
              )}
            </div>
          </Field>
        </div>
      </Section>

      <Section icon={Send} title={t("annSecPublish")}>
        <div role="radiogroup" aria-label={t("annSecPublish")} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {PUBLISH_MODES.map((m) => (
            <label
              key={m.id}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-ring",
                draft.mode === m.id ? "border-primary bg-primary/5" : "hover:bg-muted/60",
              )}
            >
              <input type="radio" name={`${formId}-mode`} className="mt-0.5 size-5 shrink-0 accent-primary" checked={draft.mode === m.id} onChange={() => setMode(m.id)} />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{t(m.label)}</span>
                <span className="text-xs text-muted-foreground">{t(m.hint)}</span>
              </span>
            </label>
          ))}
        </div>
      </Section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t bg-background/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:pb-3 sm:shadow-xs">
        {formError && (
          <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {formError}
          </p>
        )}
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {editing && (
            <Button type="button" variant="ghost" className="h-11 rounded-xl" onClick={onCancelEdit} disabled={saving}>
              {t("annCancelEdit")}
            </Button>
          )}
          <Button type="button" variant="outline" className="h-11 flex-1 rounded-xl sm:flex-none" onClick={() => setPreviewOpen(true)}>
            <Eye aria-hidden />
            {t("annPreview")}
          </Button>
          <Button type="submit" className="h-11 flex-[2] rounded-xl sm:flex-none sm:px-6" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : draft.mode === "draft" ? <FileText aria-hidden /> : <Send aria-hidden />}
            {cta}
          </Button>
        </div>
      </div>

      {previewOpen && <AnnouncementPopup announcement={previewOf(draft, images.items, editing, t)} onClose={() => setPreviewOpen(false)} preview />}
    </form>
  );
}

// The draft as the public detail popup would show it.
function previewOf(d: AnnouncementDraft, items: AnnouncementImageItem[], editing: Announcement | null, t: ReturnType<typeof useTranslation>["t"]): Announcement {
  const now = new Date();
  const point = draftPoint(d);
  const radius = Number(d.radius_m);
  const end = d.ends_at ? new Date(d.ends_at) : null;
  let url: string | null = null;
  try {
    url = d.source_url.trim() && /^https?:$/.test(new URL(d.source_url.trim()).protocol) ? d.source_url.trim() : null;
  } catch {
    url = null;
  }
  return {
    id: editing?.id ?? "preview",
    title: d.title.trim() || t("annFieldTitle"),
    body: d.body.trim() || t("annBodyPlaceholder"),
    type: d.type,
    severity: d.severity,
    source_name: d.source_name.trim() || "—",
    source_url: url,
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
    radius_m: point && d.radius_m && Number.isFinite(radius) ? radius : null,
    images: items
      .filter((it) => it.previewUrl)
      .map((it) => ({ image_key: it.image_key ?? it.id, image_url: it.previewUrl, width: it.width ?? null, height: it.height ?? null })),
    starts_at: (effectiveStart(d, now) ?? now).toISOString(),
    ends_at: end && !Number.isNaN(end.getTime()) ? end.toISOString() : null,
    status: "active",
    published_at: null,
    created_at: editing?.created_at ?? now.toISOString(),
    updated_at: now.toISOString(),
  };
}

function Section({
  icon: Icon,
  title,
  hint,
  optional,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs">
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col pt-1">
          <h3 id={id} className="text-[15px] leading-6 font-semibold">
            {title}
            {optional && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{t("optional")}</span>}
          </h3>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  required,
  optional,
  error,
  hint,
  counter,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  hint?: string;
  counter?: [number, number];
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid min-w-0 gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {required && (
            <span className="text-destructive" aria-hidden>
              *
            </span>
          )}
          {optional && <span className="font-normal text-muted-foreground">({t("optional")})</span>}
        </Label>
        {counter && counter[0] > counter[1] * 0.8 && (
          <span className="text-xs text-muted-foreground tabular-nums">{t("annCharCount", { n: counter[0], max: counter[1] })}</span>
        )}
      </div>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function AreaField({
  formId,
  draft,
  setDraft,
  errors,
}: {
  formId: string;
  draft: AnnouncementDraft;
  setDraft: React.Dispatch<React.SetStateAction<AnnouncementDraft>>;
  errors: { latitude?: string; radius_m?: string };
}) {
  const { t } = useTranslation();
  const point = draftPoint(draft);
  const { place, status } = useApproximateAddress(point);
  const radius = draft.radius_m.trim();
  const isPreset = ANNOUNCEMENT_RADIUS_PRESETS_M.some((m) => String(m) === radius);
  const [custom, setCustom] = useState(radius !== "" && !isPreset);
  const [manual, setManual] = useState(hasArea(draft) && !point);

  const pick = (p: { latitude: number; longitude: number }) =>
    setDraft((d) => ({ ...d, latitude: p.latitude.toFixed(6), longitude: p.longitude.toFixed(6), radius_m: d.latitude || d.radius_m ? d.radius_m : "1000" }));
  const chip = (active: boolean) =>
    cn(
      "min-h-11 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
    );

  return (
    <div className="flex flex-col gap-3">
      {point ? (
        <div className="flex flex-col gap-3 rounded-xl bg-muted/60 p-3">
          <div className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 size-5 shrink-0 text-indigo-700" aria-hidden />
            <div className="min-w-0 flex-1 text-sm" aria-live="polite">
              <p className="text-xs text-muted-foreground">{t("annLocation")}</p>
              <p className="truncate font-medium">{place?.name ?? (status === "loading" ? t("locatingAddress") : t("locationPinned"))}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CoordinatePickerButton value={point} onPick={pick} label={t("annChangeArea")} className="bg-background" />
            <Button
              type="button"
              variant="ghost"
              className="h-11 rounded-xl text-destructive"
              onClick={() => {
                setDraft((d) => ({ ...d, latitude: "", longitude: "", radius_m: "" }));
                setCustom(false);
              }}
            >
              <Trash2 aria-hidden />
              {t("annRemoveArea")}
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t("annRadius")}</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                aria-pressed={radius === "" && !custom}
                className={chip(radius === "" && !custom)}
                onClick={() => {
                  setCustom(false);
                  setDraft((d) => ({ ...d, radius_m: "" }));
                }}
              >
                {t("annRadiusPoint")}
              </button>
              {ANNOUNCEMENT_RADIUS_PRESETS_M.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={!custom && radius === String(m)}
                  className={chip(!custom && radius === String(m))}
                  onClick={() => {
                    setCustom(false);
                    setDraft((d) => ({ ...d, radius_m: String(m) }));
                  }}
                >
                  {formatDistance(m, t)}
                </button>
              ))}
              <button type="button" aria-pressed={custom} className={chip(custom)} onClick={() => setCustom(true)}>
                {t("annRadiusCustom")}
              </button>
            </div>
            {custom && (
              <Field id={`${formId}-radius`} label={t("annRadiusCustomLabel")} error={errors.radius_m}>
                <Input
                  id={`${formId}-radius`}
                  type="number"
                  inputMode="numeric"
                  min={ANNOUNCEMENT_RADIUS_MIN_M}
                  max={ANNOUNCEMENT_RADIUS_MAX_M}
                  step={50}
                  className={cn(inputClass, "bg-background sm:max-w-56")}
                  value={draft.radius_m}
                  aria-invalid={!!errors.radius_m}
                  onChange={(e) => setDraft((d) => ({ ...d, radius_m: e.target.value }))}
                />
              </Field>
            )}
            {!custom && errors.radius_m && <p className="text-xs font-medium text-destructive">{errors.radius_m}</p>}
          </div>
        </div>
      ) : (
        <CoordinatePickerButton value={null} onPick={pick} label={t("annPickArea")} className="h-12 w-full border-dashed text-base" />
      )}

      <details open={manual} onToggle={(e) => setManual(e.currentTarget.open)} className="text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium text-muted-foreground">{t("annManualCoords")}</summary>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Field id={`${formId}-lat`} label={t("adminFieldLat")}>
            <Input
              id={`${formId}-lat`}
              inputMode="decimal"
              className={inputClass}
              value={draft.latitude}
              aria-invalid={!!errors.latitude}
              onChange={(e) => setDraft((d) => ({ ...d, latitude: e.target.value }))}
            />
          </Field>
          <Field id={`${formId}-lng`} label={t("adminFieldLng")}>
            <Input
              id={`${formId}-lng`}
              inputMode="decimal"
              className={inputClass}
              value={draft.longitude}
              aria-invalid={!!errors.latitude}
              onChange={(e) => setDraft((d) => ({ ...d, longitude: e.target.value }))}
            />
          </Field>
        </div>
        {errors.latitude && <p className="pt-1.5 text-xs font-medium text-destructive">{errors.latitude}</p>}
      </details>
    </div>
  );
}

function ImagesField({ images }: { images: ReturnType<typeof useAnnouncementImages> }) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const full = images.items.length >= MAX_ANNOUNCEMENT_IMAGES;

  return (
    <div className="flex flex-col gap-2.5">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) images.add(files);
        }}
      />
      {!full && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
            if (files.length) images.add(files);
          }}
          className={cn(
            "flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-3 py-3 text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            dragging && "border-primary bg-primary/5 text-primary",
          )}
        >
          <ImagePlus className="size-6" aria-hidden />
          <span className="text-sm font-medium">{t("annAddImages")}</span>
          <span className="text-xs">{t("annAddImagesHint")}</span>
        </button>
      )}
      {images.items.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-live="polite">
          {images.items.map((it, i) => (
            <li key={it.id} className="relative aspect-square overflow-hidden rounded-xl border bg-muted">
              {it.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.previewUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center text-muted-foreground">
                  <Images className="size-6" aria-hidden />
                </span>
              )}
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 rounded-md bg-indigo-700 px-1.5 py-0.5 text-[11px] font-semibold text-white">{t("annImageCover")}</span>
              )}
              {it.status === "uploading" && (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-950/45 text-xs font-medium text-white">
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  {t("photoUploading")}
                </span>
              )}
              {it.status === "failed" && (
                <span className="absolute inset-0 flex flex-col items-center justify-end gap-0.5 bg-red-950/60 px-1 pb-1 text-center text-[11px] font-medium text-white">
                  <span className="flex items-center gap-1">
                    <CircleAlert className="size-4" aria-hidden />
                    {t("photoFailed")}
                  </span>
                  <button
                    type="button"
                    onClick={() => images.retry(it.id)}
                    className="flex min-h-11 items-center gap-1 rounded-lg px-2 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <RotateCw className="size-4" aria-hidden />
                    {t("retryUpload")}
                  </button>
                </span>
              )}
              <button
                type="button"
                aria-label={t("removePhoto")}
                onClick={() => images.remove(it.id)}
                className="absolute top-0 right-0 flex size-11 items-start justify-end p-1.5 focus-visible:outline-none [&:focus-visible>span]:ring-2 [&:focus-visible>span]:ring-white"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-slate-950/70 text-white">
                  <X className="size-4" aria-hidden />
                </span>
              </button>
              {i > 0 && it.status === "uploaded" && (
                <button
                  type="button"
                  aria-label={t("annImageMakeCover")}
                  title={t("annImageMakeCover")}
                  onClick={() => images.makeCover(it.id)}
                  className="absolute bottom-0 left-0 flex size-11 items-end justify-start p-1.5 focus-visible:outline-none [&:focus-visible>span]:ring-2 [&:focus-visible>span]:ring-white"
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-slate-950/70 text-white">
                    <Star className="size-4" aria-hidden />
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {images.error && (
        <p role="alert" className="text-sm text-destructive">
          {images.error}
        </p>
      )}
    </div>
  );
}
