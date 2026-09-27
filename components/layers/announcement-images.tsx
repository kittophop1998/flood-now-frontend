"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { imageKitUrl } from "@/lib/imagekit";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { AnnouncementImage } from "@/types/community";

// Delivery URL of an attached image: the API's image_url, else derived from
// the key (lib/imagekit.ts). A local preview passes a blob: URL as image_url.
export function announcementImageSrc(img: Pick<AnnouncementImage, "image_key" | "image_url">): string | null {
  return img.image_url ?? imageKitUrl(img.image_key);
}

function withSrc(images: AnnouncementImage[] | undefined) {
  return (images ?? []).map((img) => ({ ...img, src: announcementImageSrc(img) })).filter((img): img is AnnouncementImage & { src: string } => !!img.src);
}

// Small cover thumbnail for list cards; nothing without images.
export function AnnouncementThumb({ images, className }: { images: AnnouncementImage[] | undefined; className?: string }) {
  const { t } = useTranslation();
  const list = withSrc(images);
  if (list.length === 0) return null;
  return (
    <span className={cn("relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={list[0].src} alt="" loading="lazy" className="size-full object-cover" />
      {list.length > 1 && (
        <span className="absolute right-0.5 bottom-0.5 inline-flex items-center gap-0.5 rounded-md bg-slate-950/70 px-1 text-[10px] font-semibold text-white">
          <Images className="size-3" aria-hidden />
          <span className="sr-only">{t("announcementImageCount", { n: list.length })}</span>
          <span aria-hidden>{list.length}</span>
        </span>
      )}
    </span>
  );
}

// Detail gallery: the cover as a hero, the rest as a horizontal strip; any
// image opens full screen. Renders nothing without images.
export function AnnouncementGallery({ images }: { images: AnnouncementImage[] | undefined }) {
  const { t } = useTranslation();
  const list = withSrc(images);
  const [open, setOpen] = useState<number | null>(null);
  if (list.length === 0) return null;
  const total = list.length;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen(0)}
        aria-label={t("announcementImageOpen", { n: 1 })}
        className="overflow-hidden rounded-2xl bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={list[0].src}
          alt={t("announcementImageAlt", { n: 1, total })}
          width={list[0].width ?? undefined}
          height={list[0].height ?? undefined}
          loading="lazy"
          className="aspect-[16/10] w-full object-cover"
        />
      </button>
      {total > 1 && (
        <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {list.slice(1).map((img, i) => (
            <li key={img.image_key} className="shrink-0">
              <button
                type="button"
                onClick={() => setOpen(i + 1)}
                aria-label={t("announcementImageOpen", { n: i + 2 })}
                className="block size-20 overflow-hidden rounded-xl bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt={t("announcementImageAlt", { n: i + 2, total })} loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open != null && <ImageViewer images={list} index={open} onIndexChange={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}

// Full-screen viewer, nested inside the detail popup's dialog.
function ImageViewer({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: { src: string; image_key: string }[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const total = images.length;
  const go = useCallback((delta: number) => onIndexChange((index + delta + total) % total), [index, total, onIndexChange]);

  useEffect(() => {
    if (total < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, total]);

  const navButton = "absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white";

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        {/* Nested inside the detail popup: Base UI skips nested backdrops unless forced. */}
        <DialogPrimitive.Backdrop forceRender className="fixed inset-0 z-[60] bg-slate-950/95" />
        <DialogPrimitive.Popup
          aria-label={t("announcementImageAlt", { n: index + 1, total })}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 pt-[calc(env(safe-area-inset-top)+3.5rem)] pb-[calc(env(safe-area-inset-bottom)+3.5rem)] outline-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[index].src} alt={t("announcementImageAlt", { n: index + 1, total })} className="max-h-full max-w-full rounded-lg object-contain" />
          <DialogPrimitive.Close
            aria-label={t("close")}
            className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-3 flex size-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
          >
            <X className="size-5" aria-hidden />
          </DialogPrimitive.Close>
          {total > 1 && (
            <>
              <button type="button" aria-label={t("announcementImagePrev")} className={cn(navButton, "left-2")} onClick={() => go(-1)}>
                <ChevronLeft className="size-6" aria-hidden />
              </button>
              <button type="button" aria-label={t("announcementImageNext")} className={cn(navButton, "right-2")} onClick={() => go(1)}>
                <ChevronRight className="size-6" aria-hidden />
              </button>
              <p className="absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white tabular-nums" aria-live="polite">
                {index + 1} / {total}
              </p>
            </>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
