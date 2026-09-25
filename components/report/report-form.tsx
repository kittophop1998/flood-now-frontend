"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Loader2, MapPin, Pencil, Send, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImagePicker } from "@/components/report/image-picker";
import { PassabilitySelector } from "@/components/report/passability";
import { CategoryPicker, SeverityPicker, WaterDepthPicker } from "@/components/report/report-fields";
import { DuplicateNotice } from "@/components/report/duplicate-notice";
import { useImageUpload } from "@/features/reports/use-image-upload";
import { useApproximateAddress, useDuplicateReports } from "@/features/reports/use-location-lookups";
import { useNow } from "@/features/common/use-now";
import { createReportFormSchema, type ReportFormValues } from "@/lib/report-schema";
import { CATEGORY_META, hasKnownPassability, suggestPassability } from "@/lib/report-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { CreateReportInput, Passability, Report } from "@/types/report";

const UNKNOWN_PASSABILITY: Passability = { walk: "unknown", motorcycle: "unknown", sedan: "unknown", suv_pickup: "unknown" };

// Form state kept by the page while the user goes back to adjust the
// location, so nothing typed is lost.
export interface ReportDraft {
  values: Partial<ReportFormValues>;
  imageFile: File | null;
}

type LatLng = { latitude: number; longitude: number };

// Flow: location → what → how bad → details (depth/passability/help) →
// description → photo → send. Category-specific sections come from
// CATEGORY_META rather than per-category branches.
export function ReportForm({
  location,
  draft,
  onChangeLocation,
  onSubmit,
  submitting,
  submitError,
  onConfirmExisting,
  onViewExisting,
  onRequestSos,
}: {
  location: LatLng;
  draft: ReportDraft | null;
  onChangeLocation: (draft: ReportDraft) => void;
  onSubmit: (input: CreateReportInput) => void;
  submitting: boolean;
  submitError: string | null;
  onConfirmExisting: (report: Report) => Promise<void>;
  onViewExisting: (report: Report) => void;
  // Reports describe the situation for others; a person who needs help now
  // is pointed at the separate SOS flow.
  onRequestSos: () => void;
}) {
  const { t } = useTranslation();
  const now = useNow();
  const schema = useMemo(() => createReportFormSchema(t), [t]);
  const image = useImageUpload(draft?.imageFile ?? null);
  const { place, status: addressStatus } = useApproximateAddress(location);
  const [passTouched, setPassTouched] = useState(() => hasKnownPassability(draft?.values.passability ?? null));
  const [dismissedDuplicates, setDismissedDuplicates] = useState<string[]>([]);

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitted },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      water_depth: null,
      passability: UNKNOWN_PASSABILITY,
      description: "",
      people_count: null,
      has_child: false,
      has_elderly: false,
      contact_phone: "",
      ...draft?.values,
    },
  });

  const type = useWatch({ control, name: "type" });
  const fields = type ? CATEGORY_META[type].fields : null;

  const duplicates = useDuplicateReports(location, type);
  const duplicate = duplicates.data.find((r) => !dismissedDuplicates.includes(r.id));

  function currentDraft(): ReportDraft {
    return { values: getValues(), imageFile: "file" in image.state ? image.state.file : null };
  }

  function submit(values: ReportFormValues) {
    if (image.state.status === "uploading" || image.state.status === "failed") return;
    const f = CATEGORY_META[values.type].fields;
    onSubmit({
      type: values.type,
      severity: values.severity,
      latitude: location.latitude,
      longitude: location.longitude,
      water_depth: f.waterDepth ? (values.water_depth ?? "unknown") : null,
      passability: f.passability && hasKnownPassability(values.passability ?? null) ? values.passability : null,
      description: values.description?.trim() || null,
      image_key: image.state.status === "uploaded" ? image.state.objectKey : null,
      people_count: f.helpDetails ? (values.people_count ?? null) : null,
      has_child: f.helpDetails ? (values.has_child ?? null) : null,
      has_elderly: f.helpDetails ? (values.has_elderly ?? null) : null,
      contact_phone: f.helpDetails ? values.contact_phone?.trim() || null : null,
    });
  }

  function onInvalid() {
    // Bring the first missing required answer into view.
    const first = document.querySelector<HTMLElement>("[data-form-error]");
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const photoBlocking = image.state.status === "uploading" || image.state.status === "failed";

  return (
    <form onSubmit={handleSubmit(submit, onInvalid)} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain bg-muted/60 px-4 py-4">
        <Card>
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
              <MapPin className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">{t("stepLocation")}</p>
              <p className="truncate text-sm font-semibold">
                {place?.name ?? (addressStatus === "loading" ? t("locatingAddress") : t("locationPinned"))}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              </p>
            </div>
            <Button type="button" variant="outline" className="h-11 shrink-0 rounded-xl" onClick={() => onChangeLocation(currentDraft())}>
              <Pencil aria-hidden />
              {t("editLocation")}
            </Button>
          </div>
        </Card>

        <Card title={t("stepWhat")} titleId="field-type" required error={errors.type?.message}>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <CategoryPicker value={field.value} onChange={field.onChange} labelledBy="field-type" invalid={!!errors.type} />
            )}
          />
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-red-50 py-1 pr-1 pl-3">
            <p className="text-xs leading-snug text-red-900">{t("reportSosHint")}</p>
            <Button
              type="button"
              variant="ghost"
              className="h-11 shrink-0 rounded-lg px-2.5 font-semibold text-red-700 hover:bg-red-100 hover:text-red-800"
              onClick={onRequestSos}
            >
              <Siren aria-hidden />
              {t("reportSosAction")}
            </Button>
          </div>
        </Card>

        {duplicate && (
          <DuplicateNotice
            key={duplicate.id}
            report={duplicate}
            now={now}
            onConfirm={() => onConfirmExisting(duplicate)}
            onView={() => onViewExisting(duplicate)}
            onDismiss={() => setDismissedDuplicates((ids) => [...ids, duplicate.id])}
          />
        )}
        {duplicates.status === "error" && (
          <p className="flex items-center gap-2 rounded-xl bg-background px-3 py-2 text-xs text-muted-foreground">
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            {t("duplicateCheckFailed")}
          </p>
        )}

        <Card title={t("stepSeverity")} titleId="field-severity" required error={errors.severity?.message}>
          <Controller
            control={control}
            name="severity"
            render={({ field }) => (
              <SeverityPicker value={field.value} onChange={field.onChange} labelledBy="field-severity" invalid={!!errors.severity} />
            )}
          />
        </Card>

        {fields?.waterDepth && (
          <Card title={t("stepDepth")} titleId="field-depth">
            <Controller
              control={control}
              name="water_depth"
              render={({ field }) => (
                <WaterDepthPicker
                  value={field.value}
                  labelledBy="field-depth"
                  onChange={(depth) => {
                    field.onChange(depth);
                    const suggestion = suggestPassability(depth);
                    if (!passTouched && suggestion) setValue("passability", suggestion);
                  }}
                />
              )}
            />
          </Card>
        )}

        {fields?.passability && (
          <Card title={t("passabilityHeading")} titleId="field-pass" hint={t("passabilityHint")}>
            <Controller
              control={control}
              name="passability"
              render={({ field }) => (
                <>
                  {!passTouched && fields.waterDepth && hasKnownPassability(field.value ?? null) && (
                    <p className="-mt-1 mb-1 text-xs text-sky-800">{t("passabilitySuggested")}</p>
                  )}
                  <PassabilitySelector
                    value={field.value ?? UNKNOWN_PASSABILITY}
                    onChange={(next) => {
                      setPassTouched(true);
                      field.onChange(next);
                    }}
                  />
                </>
              )}
            />
          </Card>
        )}

        {fields?.helpDetails && (
          <Card title={t("stepHelp")} titleId="field-help">
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800">{t("helpNeededNotice")}</p>
            <div className="grid gap-1.5">
              <Label htmlFor="people_count">{t("peopleCountLabel")}</Label>
              <Controller
                control={control}
                name="people_count"
                render={({ field }) => (
                  <Input
                    id="people_count"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="h-11 text-base"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                  />
                )}
              />
            </div>
            <ToggleRow id="has_child" label={t("childPresent")} control={control} name="has_child" />
            <ToggleRow id="has_elderly" label={t("elderlyPresent")} control={control} name="has_elderly" />
            <div className="grid gap-1.5">
              <Label htmlFor="contact_phone">
                {t("contactPhoneLabel")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
              </Label>
              <Controller
                control={control}
                name="contact_phone"
                render={({ field }) => (
                  <Input id="contact_phone" type="tel" autoComplete="tel" className="h-11 text-base" {...field} value={field.value ?? ""} />
                )}
              />
              {errors.contact_phone && <p className="text-sm text-destructive">{errors.contact_phone.message}</p>}
            </div>
          </Card>
        )}

        <Card title={t("stepDetails")} titleId="field-description" optional error={errors.description?.message}>
          <Controller
            control={control}
            name="description"
            render={({ field }) => (
              <Textarea
                id="description"
                aria-labelledby="field-description"
                rows={3}
                className="text-base"
                placeholder={t("descriptionPlaceholder")}
                {...field}
                value={field.value ?? ""}
              />
            )}
          />
        </Card>

        <Card title={t("stepPhoto")} titleId="field-photo" optional>
          <ImagePicker state={image.state} onSelect={image.select} onRetry={image.retry} onRemove={image.remove} />
        </Card>
      </div>

      <div className="shrink-0 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {submitError && (
          <p role="alert" className="mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {submitError}
          </p>
        )}
        {image.state.status === "failed" && <p className="mb-2 text-xs text-destructive">{t("fixPhotoFirst")}</p>}
        {isSubmitted && (errors.type || errors.severity) && (
          <p className="mb-2 text-xs text-destructive">{errors.type?.message ?? errors.severity?.message}</p>
        )}
        <Button type="submit" className="h-12 w-full rounded-xl text-base" disabled={submitting || photoBlocking}>
          {submitting || image.state.status === "uploading" ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {submitting ? t("submitting") : image.state.status === "uploading" ? t("waitForPhoto") : t("submitReport")}
        </Button>
      </div>
    </form>
  );
}

function Card({
  title,
  titleId,
  required,
  optional,
  hint,
  error,
  children,
}: {
  title?: string;
  titleId?: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className={cn("flex flex-col gap-3 rounded-2xl border bg-card p-3.5 shadow-xs", error && "border-destructive/60")}>
      {title && (
        <div className="flex flex-col gap-0.5">
          <h3 id={titleId} className="flex items-center gap-2 text-sm font-semibold">
            {title}
            {required && <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-primary">{t("required")}</span>}
            {optional && <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>}
          </h3>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      )}
      {children}
      {error && (
        <p data-form-error className="flex items-center gap-1.5 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </section>
  );
}

function ToggleRow({
  id,
  label,
  control,
  name,
}: {
  id: string;
  label: string;
  control: ReturnType<typeof useForm<ReportFormValues>>["control"];
  name: "has_child" | "has_elderly";
}) {
  return (
    <div className="flex min-h-11 items-center justify-between rounded-lg bg-muted px-3">
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      <Controller control={control} name={name} render={({ field }) => <Switch id={id} checked={!!field.value} onCheckedChange={field.onChange} />} />
    </div>
  );
}
