"use client";

import { useRef } from "react";
import { Camera, CircleAlert, CircleCheck, Loader2, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/report-schema";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { ImageUploadState } from "@/features/reports/use-image-upload";

export function ImagePicker({
  state,
  onSelect,
  onRetry,
  onRemove,
}: {
  state: ImageUploadState;
  onSelect: (file: File) => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (selected) onSelect(selected);
  }

  const hasPhoto = state.status === "uploading" || state.status === "uploaded" || state.status === "failed";

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={handleSelect}
        aria-hidden
        tabIndex={-1}
      />

      {hasPhoto ? (
        <div className="flex items-center gap-3 rounded-xl border p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.previewUrl} alt="" className="size-20 shrink-0 rounded-lg bg-muted object-cover" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5" aria-live="polite">
            {state.status === "uploading" && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t("photoUploading")}
              </span>
            )}
            {state.status === "uploaded" && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-teal-700">
                <CircleCheck className="size-4" aria-hidden />
                {t("photoUploaded")}
              </span>
            )}
            {state.status === "failed" && (
              <>
                <span className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <CircleAlert className="size-4" aria-hidden />
                  {t("photoFailed")}
                </span>
                <Button type="button" variant="outline" className="h-11 self-start rounded-lg" onClick={onRetry}>
                  <RotateCw aria-hidden />
                  {t("retryUpload")}
                </Button>
              </>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 rounded-full" onClick={onRemove} aria-label={t("removePhoto")}>
            <X className="size-5" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-20 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Camera className="size-5" aria-hidden />
          <span className="text-sm font-medium">{t("addPhoto")}</span>
        </button>
      )}

      {state.status === "invalid" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t("photoHint")}</p>
    </div>
  );
}
