"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useMediaQuery } from "@/features/common/use-media-query";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

// Modal popup for "what is this thing on the map" details (reports, places,
// announcements, official layers). Phones get a floating card at the bottom
// of the screen, so the map above it still shows where the item is; wider
// screens get a centered card. The header and footer stay put while the body
// scrolls. Mount it only while open: closing calls onClose.
export function DetailPopup({
  labelledBy,
  onClose,
  header,
  footer,
  accent,
  onVisibleHeightChange,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  header: ReactNode;
  // Primary actions (directions, open source…), pinned below the body.
  footer?: ReactNode;
  // Category/marker color: tints the top of the header.
  accent?: string;
  // Phones: how much of the screen bottom the popup covers, so the map can
  // keep the selected item visible above it. Always 0 on wider screens.
  onVisibleHeightChange?: (px: number) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const popupRef = useRef<HTMLDivElement>(null);
  const isDesktop = useMediaQuery("(min-width: 640px)");

  useLayoutEffect(() => {
    const el = popupRef.current;
    if (!el || !onVisibleHeightChange) return;
    if (isDesktop) {
      onVisibleHeightChange(0);
      return;
    }
    const measure = () => onVisibleHeightChange(window.innerHeight - el.getBoundingClientRect().top);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      onVisibleHeightChange(0);
    };
  }, [isDesktop, onVisibleHeightChange]);

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-slate-950/35 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          ref={popupRef}
          aria-labelledby={labelledBy}
          // Screen readers start at the title; no focus ring on the close button.
          initialFocus={() => document.getElementById(labelledBy)}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden bg-background text-foreground shadow-[0_24px_60px_-12px_rgba(15,23,42,0.45)] ring-1 ring-slate-900/10 outline-none",
            "duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-open:animate-in data-open:fade-in-0",
            // Phones: a card floating just above the bottom edge.
            "inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] max-h-[min(78dvh,calc(100dvh-var(--safe-top)-5rem))] rounded-[1.75rem] max-sm:data-open:slide-in-from-bottom-10",
            // Wider screens: a centered card.
            "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[min(88dvh,56rem)] sm:w-[min(36rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:data-open:zoom-in-95",
          )}
        >
          <header
            className="relative shrink-0 border-b px-4 pt-4 pb-3.5 pr-14 sm:px-6 sm:pt-5 sm:pr-16"
            style={accent ? { backgroundImage: `linear-gradient(to bottom, color-mix(in oklab, ${accent} 13%, var(--background)), var(--background))` } : undefined}
          >
            {header}
            <DialogPrimitive.Close
              aria-label={t("close")}
              className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow-xs ring-1 ring-slate-900/10 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:top-4 sm:right-4"
            >
              <X className="size-5" aria-hidden />
            </DialogPrimitive.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="flex flex-col gap-5 px-4 py-4 sm:px-6 sm:py-5">{children}</div>
          </div>
          {footer && <footer className="shrink-0 border-t bg-muted/40 px-4 py-3 sm:px-6">{footer}</footer>}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function DetailSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-2.5", className)}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

// Label/value rows in one bordered card.
export function DetailList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("divide-y rounded-2xl border bg-card text-sm", className)}>{children}</dl>;
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 px-3.5 py-2.5">
      <dt className="w-24 shrink-0 text-muted-foreground sm:w-32">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium break-words">{children}</dd>
    </div>
  );
}

// Full-width link styled as a button (external maps app, official source).
export function DetailLinkButton({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: "primary" | "outline";
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-4 [&_svg]:shrink-0",
        variant === "primary" ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "border bg-background hover:bg-muted",
        className,
      )}
    >
      {children}
    </a>
  );
}
