"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { uploadAnnouncementImage } from "@/services/uploads-service";
import { compressReportImage } from "@/lib/image-compression";
import { imageKitUrl } from "@/lib/imagekit";
import { validateImageFile } from "@/lib/report-schema";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { DraftImage } from "@/lib/announcement-form";
import { MAX_ANNOUNCEMENT_IMAGES, type AnnouncementImage } from "@/types/community";

export type AnnouncementImageItem = {
  id: string;
  status: "uploading" | "uploaded" | "failed";
  // Local object URL for new picks, the delivery URL for stored images.
  previewUrl: string | null;
  file?: File;
  image_key?: string;
  width?: number | null;
  height?: number | null;
};

let nextId = 0;
const newId = () => `img-${++nextId}`;

function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

function fromStored(images: AnnouncementImage[] | undefined): AnnouncementImageItem[] {
  return (images ?? []).map((img) => ({
    id: newId(),
    status: "uploaded",
    previewUrl: img.image_url ?? imageKitUrl(img.image_key),
    image_key: img.image_key,
    width: img.width,
    height: img.height,
  }));
}

// Up to MAX_ANNOUNCEMENT_IMAGES images for the admin announcement form. Each
// pick is resized and uploaded right away (admin presign → PUT to R2), so the
// operator sees progress/failure per image and can retry or remove it; the
// announcement is only saved with already-uploaded keys.
export function useAnnouncementImages(token: string, initial: AnnouncementImage[] | undefined) {
  const { t } = useTranslation();
  const [items, setItems] = useState<AnnouncementImageItem[]>(() => fromStored(initial));
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(new Set<string>());

  const patch = useCallback((id: string, next: Partial<AnnouncementImageItem>) => {
    if (!alive.current.has(id)) return;
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...next } : it)));
  }, []);

  const upload = useCallback(
    async (id: string, file: File) => {
      patch(id, { status: "uploading" });
      try {
        const compressed = await compressReportImage(file);
        const [size, key] = await Promise.all([imageSize(compressed), uploadAnnouncementImage(token, compressed)]);
        patch(id, { status: "uploaded", image_key: key, width: size?.width ?? null, height: size?.height ?? null });
      } catch {
        patch(id, { status: "failed" });
      }
    },
    [token, patch],
  );

  const add = useCallback(
    (files: File[]) => {
      setError(null);
      const room = MAX_ANNOUNCEMENT_IMAGES - items.length;
      if (files.length > room) setError(t("annImageLimit", { n: MAX_ANNOUNCEMENT_IMAGES }));
      const added: AnnouncementImageItem[] = [];
      for (const file of files.slice(0, Math.max(room, 0))) {
        const problem = validateImageFile(file, t);
        if (problem) {
          setError(problem);
          continue;
        }
        added.push({ id: newId(), status: "uploading", previewUrl: URL.createObjectURL(file), file });
      }
      if (added.length === 0) return;
      for (const it of added) alive.current.add(it.id);
      setItems((list) => [...list, ...added]);
      for (const it of added) upload(it.id, it.file!);
    },
    [items.length, t, upload],
  );

  const retry = useCallback(
    (id: string) => {
      const it = items.find((x) => x.id === id);
      if (it?.file) upload(id, it.file);
    },
    [items, upload],
  );

  const remove = useCallback((id: string) => {
    alive.current.delete(id);
    setError(null);
    setItems((list) => {
      const it = list.find((x) => x.id === id);
      if (it?.file && it.previewUrl) URL.revokeObjectURL(it.previewUrl);
      return list.filter((x) => x.id !== id);
    });
  }, []);

  const makeCover = useCallback((id: string) => {
    setItems((list) => {
      const it = list.find((x) => x.id === id);
      return it ? [it, ...list.filter((x) => x.id !== id)] : list;
    });
  }, []);

  // Revoke local previews on unmount.
  const latest = useRef(items);
  useEffect(() => {
    latest.current = items;
  }, [items]);
  useEffect(
    () => () => {
      for (const it of latest.current) if (it.file && it.previewUrl) URL.revokeObjectURL(it.previewUrl);
    },
    [],
  );

  const pending = items.some((it) => it.status !== "uploaded");
  const uploaded: DraftImage[] = items
    .filter((it) => it.status === "uploaded" && it.image_key)
    .map((it) => ({ image_key: it.image_key!, width: it.width, height: it.height }));

  return { items, error, pending, uploaded, add, retry, remove, makeCover };
}
