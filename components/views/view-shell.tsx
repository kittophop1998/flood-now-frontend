"use client";

import { useEffect, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/lib/i18n/locale-context";

// Panel for non-map tabs. On phones it covers the map (which stays mounted
// underneath, so returning to it keeps position and loaded reports) and
// stops above the bottom navigation; on wide screens it floats at the left
// with the map still visible beside it. Sub-screens of "More" pass onBack.
export function ViewShell({
  title,
  subtitle,
  onBack,
  hidden,
  footer,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  // Kept mounted but out of view (e.g. while picking a point on the map),
  // so a half-filled form survives the round trip.
  hidden?: boolean;
  // Pinned below the scroll area, above the bottom navigation (e.g. a
  // primary action that must stay visible while the form scrolls).
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  // Move focus to the view heading when switching tabs, for screen readers
  // and keyboard users.
  useEffect(() => {
    document.getElementById("view-title")?.focus({ preventScroll: true });
  }, []);

  return (
    <section
      aria-labelledby="view-title"
      hidden={hidden}
      className="absolute inset-x-0 top-0 bottom-(--nav-h) z-20 flex flex-col bg-muted lg:inset-x-auto lg:top-3 lg:bottom-[calc(var(--nav-h)+0.75rem)] lg:left-3 lg:w-[440px] lg:overflow-hidden lg:rounded-3xl lg:border lg:shadow-[0_24px_60px_-12px_rgba(15,23,42,0.35)]"
    >
      <header className="flex shrink-0 items-start gap-1 border-b bg-background px-4 pt-[calc(var(--safe-top)+0.875rem)] pb-3 lg:pt-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t("back")}
            className="-my-1.5 -ml-2.5 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 id="view-title" tabIndex={-1} className="text-xl font-semibold outline-none">
            {title}
          </h1>
          {subtitle && <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-4">{children}</div>
      </div>
      {footer && <div className="shrink-0 border-t bg-background px-4 py-3">{footer}</div>}
    </section>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-background px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6">{icon}</span>
      <p className="font-medium">{title}</p>
      {hint && <p className="max-w-xs text-sm text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}
