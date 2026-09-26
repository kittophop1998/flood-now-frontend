"use client";

import { useState, type ReactNode } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImagePicker } from "@/components/report/image-picker";
import { PassabilitySelector } from "@/components/report/passability";
import { SeverityPicker, WaterDepthPicker } from "@/components/report/report-fields";
import { useImageUpload } from "@/features/reports/use-image-upload";
import { conditionChanges, conditionDraftFrom, type ConditionDraft } from "@/lib/condition-update";
import { imageKitUrl } from "@/lib/imagekit";
import { CATEGORY_META, suggestPassability } from "@/lib/report-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { ConditionUpdate, Report } from "@/types/report";

// "Still here — update it": anyone on the spot corrects the water depth,
// severity, per-vehicle passability or photo. Pre-filled with what the report
// shows now; only the changed fields are sent (with a still_active vote).
// The photo is resized and uploaded (presign → R2) as soon as it's picked.
// Render with a fresh `key` per opening so it starts from the latest report.
export function ReportUpdateDialog({
  report,
  open,
  onOpenChange,
  onSubmit,
  submitting,
  error,
}: {
  report: Report;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (update: ConditionUpdate) => void;
  submitting: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const fields = CATEGORY_META[report.type].fields;
  const [draft, setDraft] = useState<ConditionDraft>(() => conditionDraftFrom(report));
  const [passTouched, setPassTouched] = useState(false);
  const image = useImageUpload();
  const currentImage = report.image_url ?? imageKitUrl(report.image_key);

  const photoBlocking = image.state.status === "uploading" || image.state.status === "failed";

  function submit() {
    if (photoBlocking) return;
    onSubmit(conditionChanges(report, { ...draft, image_key: image.state.status === "uploaded" ? image.state.objectKey : null }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{t("updateTitle")}</DialogTitle>
          <DialogDescription>{t("updateBody")}</DialogDescription>
        </DialogHeader>

        <Field title={t("stepSeverity")} titleId="update-severity">
          <SeverityPicker value={draft.severity} onChange={(severity) => setDraft((d) => ({ ...d, severity }))} labelledBy="update-severity" />
        </Field>

        {fields.waterDepth && (
          <Field title={t("stepDepth")} titleId="update-depth">
            <WaterDepthPicker
              value={draft.water_depth}
              labelledBy="update-depth"
              onChange={(depth) => {
                const suggestion = fields.passability && !passTouched ? suggestPassability(depth) : null;
                setDraft((d) => ({ ...d, water_depth: depth, passability: suggestion ?? d.passability }));
              }}
            />
          </Field>
        )}

        {fields.passability && (
          <Field title={t("passabilityHeading")} titleId="update-pass">
            <PassabilitySelector
              value={draft.passability}
              onChange={(passability) => {
                setPassTouched(true);
                setDraft((d) => ({ ...d, passability }));
              }}
            />
          </Field>
        )}

        <Field title={t("stepPhoto")} titleId="update-photo">
          {currentImage && image.state.status === "empty" && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={currentImage} alt={t("currentPhoto")} className="size-14 shrink-0 rounded-lg bg-muted object-cover" />
              <span className="text-xs text-muted-foreground">{t("currentPhoto")}</span>
            </div>
          )}
          <ImagePicker state={image.state} onSelect={image.select} onRetry={image.retry} onRemove={image.remove} hint={t("updatePhotoHint")} />
        </Field>

        <div aria-live="polite" className="text-sm empty:hidden">
          {error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : (
            image.state.status === "failed" && <p className="text-xs text-destructive">{t("fixPhotoFirst")}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button className="h-11 rounded-xl" onClick={submit} disabled={submitting || photoBlocking}>
            {submitting || image.state.status === "uploading" ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            {image.state.status === "uploading" ? t("waitForPhoto") : t("updateSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ title, titleId, children }: { title: string; titleId: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 id={titleId} className="text-sm font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}
