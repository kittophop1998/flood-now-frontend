"use client";

import { useEffect, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/lib/i18n/locale-context";

// Full-screen panel for non-map tabs. It covers the map (which stays mounted
// underneath, so returning to it keeps position and loaded reports) and
// stops above the bottom navigation. Sub-screens of "More" pass onBack.
export function ViewShell({
  title,
  subtitle,
  onBack,
  hidden,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  // Kept mounted but out of view (e.g. while picking a point on the map),
  // so a half-filled form survives the round trip.
  hidden?: boolean;
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
      className="absolute inset-x-0 top-0 bottom-(--nav-h) z-20 flex flex-col bg-muted"
    >
      <header className="flex shrink-0 items-start gap-1 border-b bg-background px-4 pt-[calc(var(--safe-top)+0.875rem)] pb-3">
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
