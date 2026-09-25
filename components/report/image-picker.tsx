"use client";

import { useEffect, useMemo, useRef } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validateImageFile } from "@/lib/report-schema";
import { useTranslation } from "@/lib/i18n/locale-context";

export function ImagePicker({ file, onChange, error, onError }: {
  file: File | null;
  onChange: (file: File | null) => void;
  error: string | null;
  onError: (message: string | null) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  // Derived directly from `file` rather than mirrored into state — the
  // effect below only owns cleanup (revoking the previous object URL).
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) return;

    const validationError = validateImageFile(selected, t);
    if (validationError) {
      onError(validationError);
      onChange(null);
      return;
    }
    onError(null);
    onChange(selected);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleSelect}
      />

      {previewUrl ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Selected report photo" className="h-40 w-full rounded-lg object-cover" />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-2 top-2 size-8 rounded-full shadow"
            onClick={() => {
              onChange(null);
              onError(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            aria-label={t("removePhoto")}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Camera className="size-5" aria-hidden />
          <span className="text-sm font-medium">{t("addPhoto")}</span>
        </button>
      )}

      {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
    </div>
  );
}
