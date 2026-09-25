"use client";

import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImagePicker } from "@/components/report/image-picker";
import { createReportFormSchema, type ReportFormValues } from "@/lib/report-schema";
import { reportTypeLabel, severityLabel } from "@/lib/report-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { REPORT_TYPES, SEVERITIES } from "@/types/report";
import type { CreateReportInput } from "@/types/report";

export function ReportForm({
  latitude,
  longitude,
  onChangeLocation,
  onSubmit,
  submitting,
  submitError,
}: {
  latitude: number;
  longitude: number;
  onChangeLocation: () => void;
  onSubmit: (input: Omit<CreateReportInput, "image_key">, imageFile: File | null) => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const { t } = useTranslation();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const reportFormSchema = useMemo(() => createReportFormSchema(t), [t]);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      latitude,
      longitude,
      water_level_cm: null,
      description: "",
      people_count: null,
      has_child: false,
      has_elderly: false,
      contact_phone: "",
    } as ReportFormValues,
  });

  const type = watch("type");
  const isFlooded = type === "flooded";
  const isHelpNeeded = type === "help_needed";

  function submit(values: ReportFormValues) {
    if (imageError) return;
    onSubmit(
      {
        ...values,
        latitude,
        longitude,
        description: values.description || null,
        contact_phone: values.contact_phone || null,
      },
      imageFile,
    );
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
      <button
        type="button"
        onClick={onChangeLocation}
        className="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2.5 text-left text-sm"
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden />
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </span>
        <span className="flex items-center gap-1 font-medium text-primary">
          <Pencil className="size-3.5" aria-hidden />
          {t("change")}
        </span>
      </button>

      <div className="grid gap-2">
        <Label>{t("typeLabel")}</Label>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="h-12 w-full text-base">
                <SelectValue placeholder={t("typePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((reportType) => (
                  <SelectItem key={reportType} value={reportType}>
                    {reportTypeLabel(t, reportType)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
      </div>

      <div className="grid gap-2">
        <Label>{t("severityLabel")}</Label>
        <Controller
          control={control}
          name="severity"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="h-12 w-full text-base">
                <SelectValue placeholder={t("severityPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {severityLabel(t, s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.severity && <p className="text-sm text-destructive">{errors.severity.message}</p>}
      </div>

      {isFlooded && (
        <div className="grid gap-2">
          <Label htmlFor="water_level_cm">{t("waterLevelFieldLabel")}</Label>
          <Controller
            control={control}
            name="water_level_cm"
            render={({ field }) => (
              <Input
                id="water_level_cm"
                type="number"
                inputMode="numeric"
                min={0}
                className="h-12 text-base"
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
              />
            )}
          />
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="description">{t("descriptionLabel")}</Label>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <Textarea id="description" rows={3} placeholder={t("descriptionPlaceholder")} {...field} value={field.value ?? ""} />
          )}
        />
      </div>

      {isHelpNeeded && (
        <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-800">{t("helpNeededNotice")}</p>

          <div className="grid gap-2">
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
                  className="h-12 bg-white text-base"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                />
              )}
            />
          </div>

          <div className="flex items-center justify-between rounded-md bg-white px-3 py-2.5">
            <Label htmlFor="has_child" className="font-normal">{t("childPresent")}</Label>
            <Controller control={control} name="has_child" render={({ field }) => (
              <Switch id="has_child" checked={!!field.value} onCheckedChange={field.onChange} />
            )} />
          </div>

          <div className="flex items-center justify-between rounded-md bg-white px-3 py-2.5">
            <Label htmlFor="has_elderly" className="font-normal">{t("elderlyPresent")}</Label>
            <Controller control={control} name="has_elderly" render={({ field }) => (
              <Switch id="has_elderly" checked={!!field.value} onCheckedChange={field.onChange} />
            )} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contact_phone">{t("contactPhoneLabel")}</Label>
            <Controller
              control={control}
              name="contact_phone"
              render={({ field }) => (
                <Input id="contact_phone" type="tel" className="h-12 bg-white text-base" {...field} value={field.value ?? ""} />
              )}
            />
          </div>
        </div>
      )}

      <div className="grid gap-2">
        <Label>{t("photoLabel")}</Label>
        <ImagePicker file={imageFile} onChange={setImageFile} error={imageError} onError={setImageError} />
      </div>

      {submitError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {submitError}
        </p>
      )}

      <Button type="submit" size="lg" className="h-12 text-base" disabled={submitting}>
        {submitting ? t("submitting") : t("submitReport")}
      </Button>
    </form>
  );
}
