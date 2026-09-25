"use client";

import { useEffect, type ReactNode } from "react";

// Full-screen panel for non-map tabs. It covers the map (which stays mounted
// underneath, so returning to it keeps position and loaded reports) and
// stops above the bottom navigation.
export function ViewShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  // Move focus to the view heading when switching tabs, for screen readers
  // and keyboard users.
  useEffect(() => {
    document.getElementById("view-title")?.focus({ preventScroll: true });
  }, []);

  return (
    <section
      aria-labelledby="view-title"
      className="absolute inset-x-0 top-0 bottom-(--nav-h) z-20 flex flex-col bg-muted"
    >
      <header className="shrink-0 border-b bg-background px-4 pt-[calc(var(--safe-top)+0.875rem)] pb-3">
        <h1 id="view-title" tabIndex={-1} className="text-xl font-semibold outline-none">
          {title}
        </h1>
        {subtitle && <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>}
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
