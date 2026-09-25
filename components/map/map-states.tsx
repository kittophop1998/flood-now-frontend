"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Small floating pill for "something is loading" that never blocks the map.
export function MapStatusPill({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex items-center gap-2 rounded-full border bg-background/95 px-3.5 py-1.5 text-xs font-medium shadow-md backdrop-blur">
      <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden />
      {children}
    </div>
  );
}

// One-line notice over the map (offline, location off, load failure, empty
// area). Always icon + text; an optional action button on the right.
export function MapNotice({
  icon,
  tone = "neutral",
  children,
  action,
}: {
  icon: ReactNode;
  tone?: "neutral" | "warn" | "error";
  children: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full max-w-md items-center gap-2.5 rounded-2xl border bg-background/95 py-2 pr-2 pl-3.5 text-sm shadow-md backdrop-blur [&>svg]:size-4 [&>svg]:shrink-0",
        tone === "warn" && "border-amber-300 [&>svg]:text-amber-700",
        tone === "error" && "border-destructive/40 [&>svg]:text-destructive",
        tone === "neutral" && "[&>svg]:text-muted-foreground",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 py-1 leading-snug">{children}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="min-h-9 shrink-0 rounded-xl px-3 text-sm font-semibold text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
