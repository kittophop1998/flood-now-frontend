"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { uploadReportImage } from "@/services/uploads-service";
import { compressReportImage } from "@/lib/image-compression";
import { validateImageFile } from "@/lib/report-schema";
import { useTranslation } from "@/lib/i18n/locale-context";

export type ImageUploadState =
  | { status: "empty" }
  | { status: "invalid"; message: string }
  | { status: "uploading"; file: File; previewUrl: string }
  | { status: "uploaded"; file: File; previewUrl: string; objectKey: string }
  | { status: "failed"; file: File; previewUrl: string };

// Uploads a photo as soon as it's picked (presign → PUT to R2), so the user
// sees success/failure next to the photo and can retry or remove it before
// submitting. The report is only ever created with an already-uploaded key.
export function useImageUpload(initialFile: File | null = null) {
  const { t } = useTranslation();
  const [state, setState] = useState<ImageUploadState>({ status: "empty" });
  const attempt = useRef(0);

  const upload = useCallback(async (file: File, previewUrl: string) => {
    const id = ++attempt.current;
    setState({ status: "uploading", file, previewUrl });
    try {
      const compressed = await compressReportImage(file);
      const objectKey = await uploadReportImage(compressed);
      if (id === attempt.current) setState({ status: "uploaded", file, previewUrl, objectKey });
    } catch {
      if (id === attempt.current) setState({ status: "failed", file, previewUrl });
    }
  }, []);

  const select = useCallback(
    (file: File) => {
      const problem = validateImageFile(file, t);
      if (problem) {
        attempt.current++;
        setState({ status: "invalid", message: problem });
        return;
      }
      upload(file, URL.createObjectURL(file));
    },
    [t, upload],
  );

  const retry = useCallback(() => {
    if (state.status === "failed") upload(state.file, state.previewUrl);
  }, [state, upload]);

  const remove = useCallback(() => {
    attempt.current++;
    setState({ status: "empty" });
  }, []);

  // Restores a photo kept in a draft (e.g. after "edit location").
  const initial = useRef(initialFile);
  useEffect(() => {
    if (initial.current) select(initial.current);
    initial.current = null;
  }, [select]);

  const previewUrl = "previewUrl" in state ? state.previewUrl : null;
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return { state, select, retry, remove };
}
